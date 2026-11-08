-- Versão compacta (sem comentários) de 2026-11-08_perfis_acesso.sql, para caber no
-- SQL Editor do Neon (~9 mil caracteres). Preencha o passo 0 (CPF, e-mail, senha).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TEMP TABLE primeiro_maximo ON COMMIT DROP AS
SELECT
    'Administrador PASI'::varchar(70)   AS nome,
    'DEFINA_CPF'::varchar(11)           AS cpf,
    'DEFINA_EMAIL'::varchar(50)         AS email,
    '11900000000'::varchar(15)          AS tel_celular,
    'M'::char(1)                        AS sexo,
    'DEFINA_UMA_SENHA'::text            AS senha,
    NULL::varchar(50)                   AS unidade_sede;
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
DELETE FROM log_respostas;
DELETE FROM documentos;
DELETE FROM resposta;
DELETE FROM formulario_avaliacao;
DELETE FROM formulario_paciente;
DELETE FROM atendimento_formulario;
DELETE FROM atendimento;
DELETE FROM log_adm_geral;
UPDATE pergunta SET id_usuario_cad = NULL;
UPDATE unidade_atendimento SET id_usuario_cad = NULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuario_unidade') THEN
        EXECUTE 'DELETE FROM usuario_unidade';
    END IF;
END $$;
DELETE FROM usuario;
UPDATE tipo_usuario SET nome = 'Profissional', descricao = 'Privilégio intermediário: profissional de atendimento, restrito às suas unidades.' WHERE id_tipo_usuario = 1;
UPDATE tipo_usuario SET nome = 'Paciente', descricao = 'Privilégio mínimo: responde aos formulários pelo app.' WHERE id_tipo_usuario = 2;
INSERT INTO tipo_usuario (id_tipo_usuario, nome, descricao)
SELECT 3, 'Profissional', 'Privilégio máximo: gestão de usuários e acesso a todas as unidades.'
WHERE NOT EXISTS (SELECT 1 FROM tipo_usuario WHERE id_tipo_usuario = 3);
SELECT setval(pg_get_serial_sequence('tipo_usuario', 'id_tipo_usuario'),
              (SELECT max(id_tipo_usuario) FROM tipo_usuario));
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
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS fk_usuario_unidade;
ALTER TABLE usuario DROP COLUMN IF EXISTS id_unidade_atendimento;
CREATE TABLE IF NOT EXISTS usuario_unidade (
    id_usuario_unidade      SERIAL       NOT NULL,
    id_usuario              INTEGER      NOT NULL,
    id_unidade_atendimento  INTEGER      NOT NULL,
    sede                    BOOLEAN      NOT NULL DEFAULT FALSE,
    id_usuario_vinculo      INTEGER,
    dt_vinculo              TIMESTAMP(6) DEFAULT now(),
    CONSTRAINT pk_usuario_unidade PRIMARY KEY (id_usuario_unidade),
    CONSTRAINT fk_uu_usuario  FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario),
    CONSTRAINT fk_uu_unidade  FOREIGN KEY (id_unidade_atendimento) REFERENCES unidade_atendimento (id_unidade_atendimento),
    CONSTRAINT fk_uu_vinculo  FOREIGN KEY (id_usuario_vinculo) REFERENCES usuario (id_usuario),
    CONSTRAINT uq_uu_usuario_unidade UNIQUE (id_usuario, id_unidade_atendimento)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_uu_sede ON usuario_unidade (id_usuario) WHERE sede;
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
INSERT INTO modulo (nome, descricao)
SELECT 'Gestão de usuários', 'Cadastro e manutenção de profissionais e pacientes pelo perfil máximo.'
WHERE NOT EXISTS (SELECT 1 FROM modulo WHERE nome = 'Gestão de usuários');
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
SELECT u.id_usuario, t.nome AS tipo, s.nome AS situacao, u.ativo, u.nome, u.email,
       ua.nome AS sede
FROM usuario u
JOIN tipo_usuario t ON t.id_tipo_usuario = u.id_tipo_usuario
JOIN situacao_usuario s ON s.id_situacao_usuario = u.id_situacao_usuario
LEFT JOIN usuario_unidade uu ON uu.id_usuario = u.id_usuario AND uu.sede
LEFT JOIN unidade_atendimento ua ON ua.id_unidade_atendimento = uu.id_unidade_atendimento;
