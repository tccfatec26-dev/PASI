-- =============================================================
-- PASI - Pedido de atendente (assistente virtual do app)
--
-- O paciente pede, pelo assistente do app, para falar com uma pessoa.
-- A API manda um e-mail para a unidade do atendimento e grava um aviso
-- (tipo 4) para o profissional que criou o atendimento
-- (atendimento.id_usuario_cad).
--
-- Rodar UMA vez no banco do Neon, ANTES de publicar a API nova. Se a API
-- subir antes, o e-mail para a unidade continua saindo; só o aviso do sino
-- não é gravado (o erro vai para o log). Pode ser rodado de novo sem efeito.
-- =============================================================

BEGIN;

INSERT INTO tipo_notificacao (id_tipo_notificacao, nome, descricao) VALUES
    (4, 'Pedido de atendimento', 'O paciente pediu, pelo assistente do app, para falar com um atendente.')
ON CONFLICT (id_tipo_notificacao) DO NOTHING;

COMMIT;
