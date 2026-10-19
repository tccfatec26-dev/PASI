import { Prisma } from '@prisma/client';
import { SituacaoAtendimento, SituacaoFormulario } from './constants';

/** Situações definidas manualmente pelo profissional: nunca recalculadas. */
const SITUACOES_MANUAIS: number[] = [
  SituacaoAtendimento.ENCERRADO,
  SituacaoAtendimento.INATIVO,
];

/**
 * Calcula a situação do atendimento a partir da situação de cada
 * formulário atribuído (null = paciente ainda não iniciou):
 *   todos avaliados                 -> Avaliado
 *   algum em avaliação ou avaliado  -> Em avaliação
 *   todos respondidos               -> Respondido
 *   algum iniciado                  -> Iniciado
 *   nenhum iniciado                 -> Criado
 * A mesma regra está no script prisma/sql/2026-10-19_vinculo_atendimento.sql.
 */
export function calcularSituacaoAtendimento(
  situacoesFormularios: (number | null)[],
): number {
  const total = situacoesFormularios.length;
  const conta = (f: (s: number) => boolean) =>
    situacoesFormularios.filter((s) => s !== null && f(s)).length;

  if (total > 0 && conta((s) => s === SituacaoFormulario.AVALIADO) === total) {
    return SituacaoAtendimento.AVALIADO;
  }
  if (
    conta(
      (s) =>
        s === SituacaoFormulario.EM_AVALIACAO || s === SituacaoFormulario.AVALIADO,
    ) > 0
  ) {
    return SituacaoAtendimento.EM_AVALIACAO;
  }
  if (total > 0 && conta((s) => s >= SituacaoFormulario.RESPONDIDO) === total) {
    return SituacaoAtendimento.RESPONDIDO;
  }
  if (conta(() => true) > 0) {
    return SituacaoAtendimento.INICIADO;
  }
  return SituacaoAtendimento.CRIADO;
}

/**
 * Recalcula e grava a situação do atendimento. Usado depois de toda ação
 * que muda a situação de um formulário ou o conjunto de formulários
 * atribuídos (iniciar, concluir, avaliar, atribuir, remover).
 * Atendimentos Encerrados ou Inativos não são alterados.
 */
export async function recalcularSituacaoAtendimento(
  prisma: Prisma.TransactionClient,
  idAtendimento: number,
): Promise<void> {
  const atendimento = await prisma.atendimento.findUnique({
    where: { id_atendimento: idAtendimento },
    select: {
      id_situacao_atendimento: true,
      atendimento_formulario: { select: { id_formulario: true } },
      formulario_paciente: {
        select: { id_formulario: true, id_situacao_formulario: true },
      },
    },
  });
  if (!atendimento) return;
  if (SITUACOES_MANUAIS.includes(atendimento.id_situacao_atendimento)) return;

  const porFormulario = new Map(
    atendimento.formulario_paciente.map((fp) => [
      fp.id_formulario,
      fp.id_situacao_formulario,
    ]),
  );
  const nova = calcularSituacaoAtendimento(
    atendimento.atendimento_formulario.map(
      (af) => porFormulario.get(af.id_formulario) ?? null,
    ),
  );

  if (nova !== atendimento.id_situacao_atendimento) {
    await prisma.atendimento.update({
      where: { id_atendimento: idAtendimento },
      data: {
        situacao_atendimento: { connect: { id_situacao_atendimento: nova } },
      },
    });
  }
}
