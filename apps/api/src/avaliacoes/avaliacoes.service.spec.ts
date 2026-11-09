import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  criarDuble,
  criarPrismaMock,
  intermediario,
  paciente,
} from '../../test/helpers/dubles';
import {
  SituacaoAtendimento as SA,
  SituacaoFormulario as SF,
} from '../common/constants';
import { recalcularSituacaoAtendimento } from '../common/situacao-atendimento';
import { AvaliacoesService } from './avaliacoes.service';

jest.mock('../common/situacao-atendimento');

describe('AvaliacoesService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let acesso: ReturnType<typeof criarDuble>;
  let service: AvaliacoesService;

  const atendimentoNoBanco = (extra: Record<string, unknown> = {}) =>
    prisma.atendimento.findUnique.mockResolvedValue({
      id_atendimento: 1,
      id_situacao_atendimento: SA.RESPONDIDO,
      atendimento_formulario: [{ id_formulario: 2 }],
      ...extra,
    });

  const preenchimento = (id_situacao_formulario: number) =>
    prisma.formulario_paciente.findFirst.mockResolvedValue({
      id_formulario_paciente: 50,
      id_situacao_formulario,
    });

  const dto = { observacao: 'Encaminhar para psicólogo.' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = criarPrismaMock();
    acesso = criarDuble();
    service = new AvaliacoesService(prisma, acesso);
    atendimentoNoBanco();
    preenchimento(SF.RESPONDIDO);
    prisma.formulario_avaliacao.findMany.mockResolvedValue([
      { id_formulario_avaliacao: 1 },
    ]);
  });

  describe.each([
    [
      'iniciar',
      (s: AvaliacoesService, u = intermediario) => s.iniciar(1, 2, u),
    ],
    [
      'avaliar',
      (s: AvaliacoesService, u = intermediario) => s.avaliar(1, 2, dto, u),
    ],
  ])('%s: pré-condições', (_nome, executar) => {
    it('bloqueia quem não é profissional', async () => {
      acesso.exigirProfissional.mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(executar(service, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('responde 404 para atendimento inexistente', async () => {
      prisma.atendimento.findUnique.mockResolvedValue(null);
      await expect(executar(service)).rejects.toThrow(NotFoundException);
    });

    it('aplica a visibilidade por unidade', async () => {
      acesso.exigirAcessoAtendimento.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(executar(service)).rejects.toThrow(ForbiddenException);
    });

    it('recusa formulário não atribuído', async () => {
      atendimentoNoBanco({ atendimento_formulario: [] });
      await expect(executar(service)).rejects.toThrow('não está atribuído');
    });

    it.each([
      ['Encerrado', SA.ENCERRADO],
      ['Inativo', SA.INATIVO],
    ])('recusa atendimento %s', async (_situacao, id) => {
      atendimentoNoBanco({ id_situacao_atendimento: id });
      await expect(executar(service)).rejects.toThrow('Encerrado ou Inativo');
    });

    it('recusa formulário que o paciente não iniciou', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue(null);
      await expect(executar(service)).rejects.toThrow('ainda não respondeu');
    });

    it('recusa formulário já avaliado', async () => {
      preenchimento(SF.AVALIADO);
      await expect(executar(service)).rejects.toThrow('já foi avaliado');
    });

    it('recusa formulário ainda em rascunho', async () => {
      preenchimento(SF.RASCUNHO);
      await expect(executar(service)).rejects.toThrow('já foram respondidos');
    });
  });

  describe('iniciar', () => {
    it('move de "Respondido" para "Em avaliação" e recalcula o atendimento', async () => {
      await service.iniciar(1, 2, intermediario);
      expect(prisma.formulario_paciente.update).toHaveBeenCalledWith({
        where: { id_formulario_paciente: 50 },
        data: {
          situacao_formulario: {
            connect: { id_situacao_formulario: SF.EM_AVALIACAO },
          },
        },
      });
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });

    it('é idempotente quando já está em avaliação', async () => {
      preenchimento(SF.EM_AVALIACAO);
      await expect(service.iniciar(1, 2, intermediario)).resolves.toEqual([
        { id_formulario_avaliacao: 1 },
      ]);
      expect(prisma.formulario_paciente.update).not.toHaveBeenCalled();
    });
  });

  describe('avaliar', () => {
    it.each([
      ['Respondido', SF.RESPONDIDO],
      ['Em avaliação', SF.EM_AVALIACAO],
    ])('registra a avaliação de formulário %s', async (_nome, situacao) => {
      preenchimento(situacao);
      await service.avaliar(1, 2, dto, intermediario);

      const { data } = prisma.formulario_avaliacao.create.mock.calls[0][0];
      expect(data.observacao).toBe(dto.observacao);
      expect(data.usuario).toEqual({
        connect: { id_usuario: intermediario.id_usuario },
      });
      expect(prisma.formulario_paciente.update).toHaveBeenCalledWith({
        where: { id_formulario_paciente: 50 },
        data: {
          situacao_formulario: {
            connect: { id_situacao_formulario: SF.AVALIADO },
          },
        },
      });
    });

    it('grava avaliação e situação na mesma transação', async () => {
      await service.avaliar(1, 2, dto, intermediario);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('recalcula a situação do atendimento', async () => {
      await service.avaliar(1, 2, dto, intermediario);
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });
  });

  describe('listar', () => {
    it('devolve lista vazia sem preenchimento', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue(null);
      await expect(service.listar(1, 2, intermediario)).resolves.toEqual([]);
    });

    it('lista as avaliações do preenchimento deste atendimento', async () => {
      await service.listar(1, 2, intermediario);
      expect(prisma.formulario_avaliacao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_formulario_paciente: 50 } }),
      );
    });
  });
});
