import { criarPrismaMock } from '../../test/helpers/dubles';
import { SituacaoAtendimento as A, SituacaoFormulario as F } from './constants';
import {
  calcularSituacaoAtendimento,
  recalcularSituacaoAtendimento,
} from './situacao-atendimento';

describe('calcularSituacaoAtendimento', () => {
  it.each<[string, (number | null)[], number]>([
    ['nenhum formulário atribuído', [], A.CRIADO],
    ['nenhum formulário iniciado', [null, null], A.CRIADO],
    ['um rascunho e um não iniciado', [F.RASCUNHO, null], A.INICIADO],
    ['um respondido e um não iniciado', [F.RESPONDIDO, null], A.INICIADO],
    ['um respondido e um rascunho', [F.RESPONDIDO, F.RASCUNHO], A.INICIADO],
    ['todos respondidos', [F.RESPONDIDO, F.RESPONDIDO], A.RESPONDIDO],
    ['um em avaliação', [F.EM_AVALIACAO, F.RESPONDIDO], A.EM_AVALIACAO],
    [
      'em avaliação com outro não iniciado',
      [F.EM_AVALIACAO, null],
      A.EM_AVALIACAO,
    ],
    ['parte avaliada', [F.AVALIADO, F.RESPONDIDO], A.EM_AVALIACAO],
    ['avaliado com outro não iniciado', [F.AVALIADO, null], A.EM_AVALIACAO],
    ['todos avaliados', [F.AVALIADO, F.AVALIADO], A.AVALIADO],
    ['único formulário avaliado', [F.AVALIADO], A.AVALIADO],
  ])('%s', (_cenario, situacoes, esperado) => {
    expect(calcularSituacaoAtendimento(situacoes)).toBe(esperado);
  });
});

describe('recalcularSituacaoAtendimento', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;

  const atendimentoNoBanco = (
    situacaoAtual: number,
    atribuidos: number[],
    preenchidos: [number, number][],
  ) =>
    prisma.atendimento.findUnique.mockResolvedValue({
      id_situacao_atendimento: situacaoAtual,
      atendimento_formulario: atribuidos.map((id_formulario) => ({
        id_formulario,
      })),
      formulario_paciente: preenchidos.map(
        ([id_formulario, id_situacao_formulario]) => ({
          id_formulario,
          id_situacao_formulario,
        }),
      ),
    });

  beforeEach(() => {
    prisma = criarPrismaMock();
  });

  it('não faz nada quando o atendimento não existe', async () => {
    prisma.atendimento.findUnique.mockResolvedValue(null);
    await recalcularSituacaoAtendimento(prisma, 1);
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });

  it.each([
    ['Encerrado', A.ENCERRADO],
    ['Inativo', A.INATIVO],
  ])('preserva a situação manual %s', async (_nome, situacao) => {
    atendimentoNoBanco(situacao, [1], [[1, F.AVALIADO]]);
    await recalcularSituacaoAtendimento(prisma, 1);
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });

  it('grava a nova situação quando ela muda', async () => {
    atendimentoNoBanco(A.CRIADO, [1], [[1, F.RASCUNHO]]);
    await recalcularSituacaoAtendimento(prisma, 7);
    expect(prisma.atendimento.update).toHaveBeenCalledWith({
      where: { id_atendimento: 7 },
      data: {
        situacao_atendimento: {
          connect: { id_situacao_atendimento: A.INICIADO },
        },
      },
    });
  });

  it('não grava quando a situação continua igual', async () => {
    atendimentoNoBanco(A.INICIADO, [1], [[1, F.RASCUNHO]]);
    await recalcularSituacaoAtendimento(prisma, 1);
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });

  it('considera não iniciado o formulário atribuído sem preenchimento', async () => {
    atendimentoNoBanco(A.RESPONDIDO, [1, 2], [[1, F.RESPONDIDO]]);
    await recalcularSituacaoAtendimento(prisma, 1);
    expect(prisma.atendimento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          situacao_atendimento: {
            connect: { id_situacao_atendimento: A.INICIADO },
          },
        },
      }),
    );
  });

  it('ignora preenchimento de formulário que não está mais atribuído', async () => {
    atendimentoNoBanco(A.CRIADO, [2], [[1, F.AVALIADO]]);
    await recalcularSituacaoAtendimento(prisma, 1);
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });
});
