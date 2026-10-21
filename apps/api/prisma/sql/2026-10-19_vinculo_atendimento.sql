-- =============================================================
-- PASI - Alteração de schema: respostas e avaliações por atendimento
--
-- Corrige as inconsistências críticas #1 e #2 do levantamento de regras:
--   #1 formulario_avaliacao não sabia de qual paciente/atendimento era a
--      avaliação (um atendimento podia virar "Avaliado" por causa da
--      avaliação de outro paciente);
--   #2 formulario_paciente era único por formulário + paciente, então o
--      mesmo formulário em outro atendimento do mesmo paciente já nascia
--      respondido/avaliado, com as respostas antigas.
--
-- O que este script faz:
--   1. formulario_paciente.id_atendimento  (FK para atendimento)
--   2. formulario_avaliacao.id_formulario_paciente  (FK para formulario_paciente)
--   3. Preenche os dados existentes (backfill), quando dá para saber o vínculo
--   4. Índice único (id_atendimento, id_formulario) em formulario_paciente
--   5. Recalcula a situação dos atendimentos abertos a partir dos formulários
--   6. Mostra o que ficou sem vínculo, para conferência manual
--
-- Rodar UMA vez no banco do Neon (DBeaver/psql/console do Neon), ANTES de
-- publicar a versão da API que usa estas colunas. Tudo roda numa transação:
-- se algo falhar, nada é alterado. Pode ser rodado de novo sem efeito colateral.
-- Recomendado: testar antes numa branch do Neon (cópia do banco).
-- =============================================================

BEGIN;

-- 1 e 2. Novas colunas (nulas: registros antigos podem não ter vínculo)
ALTER TABLE formulario_paciente
    ADD COLUMN IF NOT EXISTS id_atendimento INTEGER;

ALTER TABLE formulario_avaliacao
    ADD COLUMN IF NOT EXISTS id_formulario_paciente INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fp_atendimento') THEN
        ALTER TABLE formulario_paciente
            ADD CONSTRAINT fk_fp_atendimento
            FOREIGN KEY (id_atendimento) REFERENCES atendimento (id_atendimento);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fav_formpac') THEN
        ALTER TABLE formulario_avaliacao
            ADD CONSTRAINT fk_fav_formpac
            FOREIGN KEY (id_formulario_paciente) REFERENCES formulario_paciente (id_formulario_paciente);
    END IF;
END $$;

-- 3a. Backfill de formulario_paciente.id_atendimento
-- Cada registro antigo vai para o atendimento MAIS ANTIGO do mesmo paciente
-- que tem aquele formulário atribuído (foi nele que o paciente respondeu).
-- Se houver registros duplicados do mesmo formulário + paciente, só o de
-- menor id recebe o vínculo; os demais ficam nulos (listados no passo 6).
WITH alvo AS (
    SELECT fp.id_formulario_paciente,
           (SELECT MIN(af.id_atendimento)
              FROM atendimento_formulario af
              JOIN atendimento a ON a.id_atendimento = af.id_atendimento
             WHERE a.id_usuario_paciente = fp.id_usuario_paciente
               AND af.id_formulario = fp.id_formulario) AS id_atendimento,
           ROW_NUMBER() OVER (
               PARTITION BY fp.id_usuario_paciente, fp.id_formulario
               ORDER BY fp.id_formulario_paciente) AS ordem
      FROM formulario_paciente fp
     WHERE fp.id_atendimento IS NULL
)
UPDATE formulario_paciente fp
   SET id_atendimento = alvo.id_atendimento
  FROM alvo
 WHERE alvo.id_formulario_paciente = fp.id_formulario_paciente
   AND alvo.ordem = 1
   AND alvo.id_atendimento IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM formulario_paciente outro
        WHERE outro.id_atendimento = alvo.id_atendimento
          AND outro.id_formulario = fp.id_formulario);

-- 3b. Backfill de formulario_avaliacao.id_formulario_paciente
-- A avaliação antiga só guardava o formulário. O vínculo só é feito quando
-- não há dúvida: existe exatamente UM formulario_paciente "Avaliado" (4)
-- daquele formulário. Nos outros casos fica nulo (listado no passo 6).
UPDATE formulario_avaliacao fav
   SET id_formulario_paciente = (
       SELECT fp.id_formulario_paciente
         FROM formulario_paciente fp
        WHERE fp.id_formulario = fav.id_formulario
          AND fp.id_situacao_formulario = 4)
 WHERE fav.id_formulario_paciente IS NULL
   AND (SELECT COUNT(*)
          FROM formulario_paciente fp
         WHERE fp.id_formulario = fav.id_formulario
           AND fp.id_situacao_formulario = 4) = 1
   AND (SELECT COUNT(*)
          FROM formulario_avaliacao f2
         WHERE f2.id_formulario = fav.id_formulario) = 1;

-- 4. Um registro por formulário em cada atendimento
CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_atendimento_formulario
    ON formulario_paciente (id_atendimento, id_formulario);

-- 5. Recalcula a situação dos atendimentos que não foram encerrados nem
-- inativados, com a mesma regra que a API passa a usar:
--   todos os formulários avaliados            -> 5 Avaliado
--   algum formulário em avaliação ou avaliado -> 4 Em avaliação
--   todos os formulários respondidos          -> 3 Respondido
--   algum formulário iniciado                 -> 2 Iniciado
--   nenhum formulário iniciado                -> 1 Criado
WITH resumo AS (
    SELECT a.id_atendimento,
           COUNT(af.id_formulario)                                      AS total,
           COUNT(fp.id_formulario_paciente)                             AS iniciados,
           COUNT(*) FILTER (WHERE fp.id_situacao_formulario >= 2)       AS respondidos,
           COUNT(*) FILTER (WHERE fp.id_situacao_formulario IN (3, 4))  AS em_avaliacao,
           COUNT(*) FILTER (WHERE fp.id_situacao_formulario = 4)        AS avaliados
      FROM atendimento a
      LEFT JOIN atendimento_formulario af ON af.id_atendimento = a.id_atendimento
      LEFT JOIN formulario_paciente fp
             ON fp.id_atendimento = a.id_atendimento
            AND fp.id_formulario = af.id_formulario
     WHERE a.id_situacao_atendimento NOT IN (6, 7)
     GROUP BY a.id_atendimento
),
nova AS (
    SELECT id_atendimento,
           CASE
               WHEN total > 0 AND avaliados = total   THEN 5
               WHEN em_avaliacao > 0                  THEN 4
               WHEN total > 0 AND respondidos = total THEN 3
               WHEN iniciados > 0                     THEN 2
               ELSE 1
           END AS situacao
      FROM resumo
)
UPDATE atendimento a
   SET id_situacao_atendimento = nova.situacao
  FROM nova
 WHERE nova.id_atendimento = a.id_atendimento
   AND a.id_situacao_atendimento <> nova.situacao;

COMMIT;

-- 6. Conferência (só leitura): o que ficou sem vínculo.
-- Formulários do paciente sem atendimento: as respostas continuam no banco,
-- mas não aparecem em nenhum atendimento.
SELECT fp.id_formulario_paciente, fp.id_usuario_paciente, fp.id_formulario,
       fp.id_situacao_formulario
  FROM formulario_paciente fp
 WHERE fp.id_atendimento IS NULL;

-- Avaliações antigas sem paciente definido: continuam no banco, mas a
-- observação não aparece na tela de nenhum atendimento. Se souber de qual
-- atendimento é cada uma, preencha id_formulario_paciente manualmente.
SELECT fav.id_formulario_avaliacao, fav.id_formulario, fav.id_usuario_avaliador,
       fav.dt_avaliacao, fav.observacao
  FROM formulario_avaliacao fav
 WHERE fav.id_formulario_paciente IS NULL;
