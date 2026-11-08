-- =============================================================
-- PASI - Remodelagem dos perfis de acesso (painel web)
--
-- Implementa o "DER da remodelagem" e as regras RN-USR-01 a RN-USR-25:
--   1. Limpa os dados de teste (RN-USR-25): usuários, atendimentos,
--      respostas, avaliações e logs. Mantém as tabelas de domínio, as
--      unidades de atendimento e os formulários (com perguntas e opções).
--   2. tipo_usuario: 1 = intermediário, 2 = paciente, 3 = máximo (novo).
--   3. situacao_usuario (nova): 1 Pendência I, 2 Pendência II, 3 Deferido.
--   4. usuario: + id_situacao_usuario, + ativo, + senha_provisoria_expira_em,
--      - id_unidade_atendimento (as unidades vão para usuario_unidade).
--   5. usuario_unidade (nova): N unidades por profissional, exatamente
--      uma sede (índice único parcial).
--   6. atendimento: + id_unidade_atendimento (FK que aceita nulo;
--      a obrigatoriedade é garantida pela API - RN-USR-20).
--   7. log_adm_geral: + id_usuario_alvo.
--   8. modulo "Gestão de usuários" e as ações da gestão (tabela acao).
--   9. Cria o primeiro usuário máximo (RN-USR-01), já Deferido e ativo.
--
-- COMO RODAR (uma vez, no console SQL do Neon, DBeaver ou psql):
--   a) Edite o PASSO 0 com os dados reais do primeiro máximo.
--   b) Rode o script inteiro. Tudo acontece numa transação: se algo
--      falhar, nada é alterado.
--   c) Publique a versão da API que usa estas colunas (merge na dev).
--
-- ATENÇÃO: o passo 1 APAGA todos os usuários e atendimentos atuais.
-- Pode ser rodado de novo: os passos de esquema usam IF NOT EXISTS.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt()/gen_salt() p/ o hash bcrypt
CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca sem acentos (já usada pela API)

-- -------------------------------------------------------------
-- 0. Primeiro usuário máximo - EDITE AQUI
--    senha: definitiva, já no padrão forte (8+ caracteres, maiúscula,
--    minúscula, número e caractere especial). Troque-a depois pelo
--    card "Segurança" do Meu perfil.
--    unidade_sede: nome exato de uma unidade de unidade_atendimento.
--    O repositório é público: preencha CPF, e-mail e senha só na cópia
--    que vai rodar no console do Neon — não commite esses valores.
-- -------------------------------------------------------------
CREATE TEMP TABLE primeiro_maximo ON COMMIT DROP AS
SELECT
    'Administrador PASI'::varchar(70)   AS nome,          -- troque pelo nome real
    'DEFINA_CPF'::varchar(11)           AS cpf,           -- só números (11 dígitos)
    'DEFINA_EMAIL'::varchar(50)         AS email,         -- e-mail real (recebe os avisos)
    '11900000000'::varchar(15)          AS tel_celular,   -- troque pelo celular real
    'M'::char(1)                        AS sexo,          -- F, M ou O
    'DEFINA_UMA_SENHA'::text            AS senha,         -- troque ANTES de rodar (não commitar a senha real)
    NULL::varchar(50)                   AS unidade_sede;  -- NULL = primeira unidade cadastrada

DO $$
BEGIN
    IF (SELECT senha FROM primeiro_maximo) = 'DEFINA_UMA_SENHA'
       OR (SELECT senha FROM primeiro_maximo) !~ '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$' THEN
        RAISE EXCEPTION 'Defina no passo 0 uma senha forte para o primeiro máximo (8+ caracteres, maiúscula, minúscula, número e caractere especial). Nada foi alterado.';
    END IF;
    IF (SELECT cpf FROM primeiro_maximo) !~ '^[0-9]{11}$' THEN
        RAISE EXCEPTION 'Defina no passo 0 o CPF do primeiro máximo (11 dígitos, só números). Nada foi alterado.';
    END IF;
    IF (SELECT email FROM primeiro_maximo) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'Defina no passo 0 o e-mail do primeiro máximo. Nada foi alterado.';
    END IF;
END $$;

-- -------------------------------------------------------------
-- 1. Limpeza dos dados de teste (RN-USR-25)
-- -------------------------------------------------------------
DELETE FROM log_respostas;
-- Documentos (de respostas e de apoio dos formulários) apontam para o autor,
-- que é um usuário de teste: saem junto.
DELETE FROM documentos;
DELETE FROM resposta;
DELETE FROM formulario_avaliacao;
DELETE FROM formulario_paciente;
DELETE FROM atendimento_formulario;
DELETE FROM atendimento;
DELETE FROM log_adm_geral;
-- Formulários continuam; tiramos só a referência ao autor.
UPDATE pergunta SET id_usuario_cad = NULL;
UPDATE unidade_atendimento SET id_usuario_cad = NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuario_unidade') THEN
        EXECUTE 'DELETE FROM usuario_unidade';
    END IF;
END $$;
DELETE FROM usuario;

-- -------------------------------------------------------------
-- 2. tipo_usuario (1 intermediário, 2 paciente, 3 máximo)
-- -------------------------------------------------------------
UPDATE tipo_usuario SET nome = 'Profissional', descricao = 'Privilégio intermediário: profissional de atendimento, restrito às suas unidades.' WHERE id_tipo_usuario = 1;
UPDATE tipo_usuario SET nome = 'Paciente', descricao = 'Privilégio mínimo: responde aos formulários pelo app.' WHERE id_tipo_usuario = 2;
INSERT INTO tipo_usuario (id_tipo_usuario, nome, descricao)
SELECT 3, 'Profissional', 'Privilégio máximo: gestão de usuários e acesso a todas as unidades.'
WHERE NOT EXISTS (SELECT 1 FROM tipo_usuario WHERE id_tipo_usuario = 3);
SELECT setval(pg_get_serial_sequence('tipo_usuario', 'id_tipo_usuario'),
              (SELECT max(id_tipo_usuario) FROM tipo_usuario));

-- -------------------------------------------------------------
-- 3. situacao_usuario
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS situacao_usuario (
    id_situacao_usuario SMALLINT     NOT NULL,
    nome                VARCHAR(40)  NOT NULL,
    descricao           VARCHAR(300),
    CONSTRAINT pk_situacao_usuario PRIMARY KEY (id_situacao_usuario)
);
INSERT INTO situacao_usuario (id_situacao_usuario, nome, descricao) VALUES
    (1, 'Pendência I – Senha de acesso',  'Recebeu a senha provisória e ainda não definiu a própria senha.'),
    (2, 'Pendência II – Revisão de dados', 'Já definiu a senha e ainda não confirmou os dados cadastrados.'),
    (3, 'Deferido',                        'Cadastro concluído: usa tudo o que o perfil permite.')
ON CONFLICT (id_situacao_usuario) DO UPDATE
    SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

-- -------------------------------------------------------------
-- 4. usuario
-- -------------------------------------------------------------
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS id_situacao_usuario SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS senha_provisoria_expira_em TIMESTAMP(6);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuario_situacao') THEN
        ALTER TABLE usuario
            ADD CONSTRAINT fk_usuario_situacao
            FOREIGN KEY (id_situacao_usuario) REFERENCES situacao_usuario (id_situacao_usuario);
    END IF;
END $$;

-- A unidade única do profissional dá lugar a usuario_unidade.
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS fk_usuario_unidade;
ALTER TABLE usuario DROP COLUMN IF EXISTS id_unidade_atendimento;

-- -------------------------------------------------------------
-- 5. usuario_unidade
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_unidade (
    id_usuario_unidade      SERIAL       NOT NULL,
    id_usuario              INTEGER      NOT NULL,
    id_unidade_atendimento  INTEGER      NOT NULL,
    sede                    BOOLEAN      NOT NULL DEFAULT FALSE,
    id_usuario_vinculo      INTEGER,                 -- quem vinculou (nulo = no cadastro)
    dt_vinculo              TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT pk_usuario_unidade PRIMARY KEY (id_usuario_unidade),
    CONSTRAINT fk_uu_usuario  FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_uu_unidade  FOREIGN KEY (id_unidade_atendimento) REFERENCES unidade_atendimento (id_unidade_atendimento),
    CONSTRAINT fk_uu_vinculo  FOREIGN KEY (id_usuario_vinculo) REFERENCES usuario (id_usuario),
    CONSTRAINT uq_uu_usuario_unidade UNIQUE (id_usuario, id_unidade_atendimento)
);
-- Exatamente uma sede por usuário (no máximo uma no banco; a API garante "pelo menos uma").
CREATE UNIQUE INDEX IF NOT EXISTS uq_uu_sede ON usuario_unidade (id_usuario) WHERE sede;

-- -------------------------------------------------------------
-- 6. atendimento.id_unidade_atendimento
-- -------------------------------------------------------------
ALTER TABLE atendimento ADD COLUMN IF NOT EXISTS id_unidade_atendimento INTEGER;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_atend_unidade') THEN
        ALTER TABLE atendimento
            ADD CONSTRAINT fk_atend_unidade
            FOREIGN KEY (id_unidade_atendimento) REFERENCES unidade_atendimento (id_unidade_atendimento);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_atend_unidade ON atendimento (id_unidade_atendimento);

-- -------------------------------------------------------------
-- 7. log_adm_geral.id_usuario_alvo
-- -------------------------------------------------------------
ALTER TABLE log_adm_geral ADD COLUMN IF NOT EXISTS id_usuario_alvo INTEGER;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lag_alvo') THEN
        ALTER TABLE log_adm_geral
            ADD CONSTRAINT fk_lag_alvo
            FOREIGN KEY (id_usuario_alvo) REFERENCES usuario (id_usuario);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_lag_alvo ON log_adm_geral (id_usuario_alvo);

-- -------------------------------------------------------------
-- 8. modulo e acao da gestão de usuários
-- -------------------------------------------------------------
INSERT INTO modulo (nome, descricao)
SELECT 'Gestão de usuários', 'Cadastro e manutenção de profissionais e pacientes pelo perfil máximo.'
WHERE NOT EXISTS (SELECT 1 FROM modulo WHERE nome = 'Gestão de usuários');

-- Aprovação e recusa de cadastro deixaram de existir.
DELETE FROM acao WHERE nome IN ('Aprovar cadastro', 'Recusar cadastro');

INSERT INTO acao (nome, descricao)
SELECT v.nome, v.descricao
FROM (VALUES
    ('Cadastrar usuário',         'Cadastro de profissional pelo perfil máximo.'),
    ('Reenviar senha provisória', 'Nova senha provisória, válida por 24 horas.'),
    ('Corrigir e-mail',           'Correção do e-mail de um cadastro em Pendência I, com nova senha provisória.'),
    ('Inativar usuário',          'O usuário deixa de conseguir entrar.'),
    ('Reativar usuário',          'O usuário volta a conseguir entrar.'),
    ('Promover a máximo',         'Intermediário passa a privilégio máximo.'),
    ('Vincular unidade',          'Nova unidade de atendimento para o profissional.'),
    ('Desvincular unidade',       'Remoção de uma unidade de atendimento do profissional.'),
    ('Trocar sede',               'Outra unidade vinculada passa a ser a sede.')
) AS v(nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM acao a WHERE a.nome = v.nome);

-- -------------------------------------------------------------
-- 9. Primeiro usuário máximo (RN-USR-01)
-- -------------------------------------------------------------
DO $$
DECLARE
    v_id_usuario INTEGER;
    v_id_unidade INTEGER;
BEGIN
    SELECT u.id_unidade_atendimento INTO v_id_unidade
    FROM unidade_atendimento u, primeiro_maximo p
    WHERE p.unidade_sede IS NULL OR u.nome = p.unidade_sede
    ORDER BY u.id_unidade_atendimento
    LIMIT 1;

    IF v_id_unidade IS NULL THEN
        RAISE EXCEPTION 'Nenhuma unidade de atendimento encontrada para a sede do primeiro máximo. Nada foi alterado.';
    END IF;

    INSERT INTO usuario (id_tipo_usuario, id_situacao_usuario, ativo, nome, sexo, cpf, email, tel_celular, senha_hash)
    SELECT 3, 3, TRUE, p.nome, p.sexo, p.cpf, lower(p.email), p.tel_celular, crypt(p.senha, gen_salt('bf', 10))
    FROM primeiro_maximo p
    RETURNING id_usuario INTO v_id_usuario;

    INSERT INTO usuario_unidade (id_usuario, id_unidade_atendimento, sede)
    VALUES (v_id_usuario, v_id_unidade, TRUE);
END $$;

COMMIT;

-- Conferência
SELECT u.id_usuario, t.nome AS tipo, s.nome AS situacao, u.ativo, u.nome, u.email,
       ua.nome AS sede
FROM usuario u
JOIN tipo_usuario t ON t.id_tipo_usuario = u.id_tipo_usuario
JOIN situacao_usuario s ON s.id_situacao_usuario = u.id_situacao_usuario
LEFT JOIN usuario_unidade uu ON uu.id_usuario = u.id_usuario AND uu.sede
LEFT JOIN unidade_atendimento ua ON ua.id_unidade_atendimento = uu.id_unidade_atendimento;
