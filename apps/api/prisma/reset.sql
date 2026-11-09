-- =============================================================
-- PASI — Reset do banco de dados
-- Apaga todos os dados de transação e mantém:
--   • Tabelas de domínio (tipos, situações, unidades, etc.)
--   • Apenas os formulários 2 (Triagem Socioeconômica) e 6 (SCARED)
--   • Apenas os usuários listados em usuarios_mantidos (passo 0)
--
-- ANTES DE RODAR: troque os e-mails do passo 0 pelos usuários que devem
-- continuar no banco. Se algum deles não existir, o script aborta sem apagar nada.
-- =============================================================

BEGIN;

-- 0. Usuários que serão mantidos — EDITE AQUI
CREATE TEMP TABLE usuarios_mantidos (email VARCHAR(50)) ON COMMIT DROP;
INSERT INTO usuarios_mantidos (email) VALUES
    ('profissional@exemplo.com'),
    ('paciente@exemplo.com');

-- Trava: sem isso, e-mails errados apagariam TODOS os usuários.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM usuario u JOIN usuarios_mantidos m ON m.email = u.email)
       <> (SELECT COUNT(*) FROM usuarios_mantidos) THEN
        RAISE EXCEPTION 'Algum e-mail de usuarios_mantidos não existe no banco. Nada foi apagado.';
    END IF;
END $$;

-- 1. Logs e documentos (sem dependentes)
DELETE FROM log_respostas;
DELETE FROM documentos;

-- 2. Respostas
DELETE FROM resposta;

-- 3. Avaliações e vínculos formulário-paciente
DELETE FROM formulario_avaliacao;
DELETE FROM formulario_paciente;

-- 4. Vínculos atendimento-formulário e atendimentos
DELETE FROM atendimento_formulario;
DELETE FROM atendimento;

-- 5. Logs administrativos
DELETE FROM log_adm_geral;

-- 6. Remover formulários exceto 2 e 6 (e suas perguntas/opções)
DELETE FROM opcao_pergunta
WHERE id_pergunta IN (
    SELECT id_pergunta FROM pergunta WHERE id_formulario NOT IN (2, 6)
);
DELETE FROM pergunta WHERE id_formulario NOT IN (2, 6);
DELETE FROM formulario WHERE id_formulario NOT IN (2, 6);

-- 7. Nullificar FK opcional de usuário em perguntas
--    (evita violação de FK ao excluir usuários)
UPDATE pergunta SET id_usuario_cad = NULL;

-- 8. Excluir todos os usuários exceto os mantidos (com os vínculos de
--    unidade deles — tabela usuario_unidade, criada em 2026-11-08)
UPDATE unidade_atendimento SET id_usuario_cad = NULL
WHERE id_usuario_cad IN (
    SELECT id_usuario FROM usuario WHERE email NOT IN (SELECT email FROM usuarios_mantidos)
);
DELETE FROM usuario_unidade
WHERE id_usuario IN (
    SELECT id_usuario FROM usuario WHERE email NOT IN (SELECT email FROM usuarios_mantidos)
)
   OR id_usuario_vinculo IN (
    SELECT id_usuario FROM usuario WHERE email NOT IN (SELECT email FROM usuarios_mantidos)
);
DELETE FROM usuario
WHERE email NOT IN (SELECT email FROM usuarios_mantidos);

COMMIT;

-- Verificação final
SELECT id_usuario, id_tipo_usuario, nome, email
FROM usuario
ORDER BY id_usuario;
