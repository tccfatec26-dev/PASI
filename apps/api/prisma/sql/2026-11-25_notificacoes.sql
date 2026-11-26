-- =============================================================
-- PASI - Notificações
--
-- Avisos dentro do sistema (sino do painel web e do app):
--   1 Incluído em atendimento  -> o PACIENTE, quando um profissional o
--                                 inclui em um atendimento (ao criar o
--                                 atendimento ou ao trocar o paciente dele)
--   2 Novos formulários        -> o PACIENTE, quando o profissional atribui
--                                 formulários a um atendimento já existente
--   3 Formulário respondido    -> o PROFISSIONAL que CRIOU o atendimento
--                                 (atendimento.id_usuario_cad), quando o
--                                 paciente conclui um formulário dele.
--                                 Outros profissionais não são avisados.
--
-- O que este script faz:
--   1. tipo_notificacao (tabela de domínio, ids fixos 1, 2 e 3)
--   2. notificacao (uma linha por aviso, por destinatário)
--   3. índice para a listagem do sino (por usuário, mais recentes primeiro)
--
-- Rodar UMA vez no banco do Neon (SQL Editor/DBeaver/psql), ANTES de publicar
-- a versão da API que grava notificações. Se a API nova subir antes, ela
-- continua funcionando: só não grava os avisos (registra o erro no log).
-- Tudo roda numa transação e pode ser rodado de novo sem efeito colateral.
-- =============================================================

BEGIN;

-- 1. Tipos de notificação (ids fixos, iguais a TipoNotificacao na API)
CREATE TABLE IF NOT EXISTS tipo_notificacao (
    id_tipo_notificacao SMALLINT     NOT NULL,
    nome                VARCHAR(40)  NOT NULL,
    descricao           VARCHAR(300),
    CONSTRAINT pk_tipo_notificacao PRIMARY KEY (id_tipo_notificacao)
);

INSERT INTO tipo_notificacao (id_tipo_notificacao, nome, descricao) VALUES
    (1, 'Incluído em atendimento', 'O paciente foi incluído em um atendimento.'),
    (2, 'Novos formulários',       'Formulários foram atribuídos a um atendimento do paciente.'),
    (3, 'Formulário respondido',   'O paciente concluiu um formulário de um atendimento criado pelo profissional.')
ON CONFLICT (id_tipo_notificacao) DO NOTHING;

-- 2. Notificações
CREATE TABLE IF NOT EXISTS notificacao (
    id_notificacao      SERIAL        NOT NULL,
    id_usuario          INTEGER       NOT NULL,  -- quem recebe
    id_tipo_notificacao SMALLINT      NOT NULL,
    titulo              VARCHAR(100)  NOT NULL,
    mensagem            VARCHAR(300)  NOT NULL,
    id_atendimento      INTEGER,                 -- para abrir a tela certa
    id_formulario       INTEGER,
    id_usuario_origem   INTEGER,                 -- quem causou o aviso
    lida                BOOLEAN       NOT NULL DEFAULT FALSE,
    dt_leitura          TIMESTAMP(6),
    dt_cadastro         TIMESTAMP(6)  NOT NULL DEFAULT now(),
    CONSTRAINT pk_notificacao PRIMARY KEY (id_notificacao),
    CONSTRAINT fk_notif_usuario     FOREIGN KEY (id_usuario)          REFERENCES usuario (id_usuario),
    CONSTRAINT fk_notif_tipo        FOREIGN KEY (id_tipo_notificacao) REFERENCES tipo_notificacao (id_tipo_notificacao),
    CONSTRAINT fk_notif_atendimento FOREIGN KEY (id_atendimento)      REFERENCES atendimento (id_atendimento),
    CONSTRAINT fk_notif_formulario  FOREIGN KEY (id_formulario)       REFERENCES formulario (id_formulario),
    CONSTRAINT fk_notif_origem      FOREIGN KEY (id_usuario_origem)   REFERENCES usuario (id_usuario)
);

-- 3. Listagem do sino: notificações de um usuário, mais recentes primeiro
CREATE INDEX IF NOT EXISTS ix_notif_usuario
    ON notificacao (id_usuario, id_notificacao DESC);

COMMIT;
