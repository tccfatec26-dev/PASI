-- =============================================================
-- PASI - Notificações push (aparelhos do app)
--
-- Cada linha é um aparelho com o app PASI instalado e logado, com o token de
-- push do Expo ("ExponentPushToken[...]"). Quando a API grava uma
-- notificação (sino), ela também manda o push para os aparelhos de quem
-- recebe; assim o aviso chega mesmo com o app fechado.
--
-- O app registra o aparelho ao entrar (PUT /notificacoes/dispositivos) e o
-- remove ao sair da conta (DELETE /notificacoes/dispositivos). Um token que o
-- serviço do Expo diz não existir mais (DeviceNotRegistered) é apagado pela
-- própria API. O mesmo aparelho usado por outra conta passa para ela.
--
-- Rodar UMA vez no banco do Neon (SQL Editor/DBeaver/psql), ANTES de publicar
-- a versão da API que envia push. Se a API nova subir antes, ela continua
-- funcionando: só não registra aparelhos nem envia push (registra o erro no
-- log). Tudo roda numa transação e pode ser rodado de novo sem efeito colateral.
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS dispositivo_push (
    id_dispositivo_push SERIAL        NOT NULL,
    id_usuario          INTEGER       NOT NULL,  -- dono do aparelho (quem está logado)
    token               VARCHAR(255)  NOT NULL,  -- ExponentPushToken[...]
    plataforma          VARCHAR(20),             -- android / ios
    dt_cadastro         TIMESTAMP(6)  NOT NULL DEFAULT now(),
    dt_atualizacao      TIMESTAMP(6)  NOT NULL DEFAULT now(),
    CONSTRAINT pk_dispositivo_push PRIMARY KEY (id_dispositivo_push),
    CONSTRAINT uq_dispositivo_push_token UNIQUE (token),
    CONSTRAINT fk_disp_push_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE
);

-- Envio: aparelhos de um usuário
CREATE INDEX IF NOT EXISTS ix_disp_push_usuario
    ON dispositivo_push (id_usuario);

COMMIT;
