import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  criarDuble,
  criarPrismaMock,
  erroPrisma,
  intermediario,
  paciente,
} from '../../test/helpers/dubles';
import {
  SituacaoAtendimento as SA,
  SituacaoFormulario as SF,
  TipoPergunta as T,
} from '../common/constants';
import { recalcularSituacaoAtendimento } from '../common/situacao-atendimento';
import { RespostasService } from './respostas.service';

jest.mock('../common/situacao-atendimento');

const FP = { id_formulario_paciente: 50, id_situacao_formulario: SF.RASCUNHO };

const pergunta = (
  id_pergunta: number,
  id_tipo_pergunta: number,
  extra: Record<string, unknown> = {},
) => ({
  id_pergunta,
  id_tipo_pergunta,
  pergunta: `Pergunta ${id_pergunta}`,
  valor_minimo: null,
  valor_maximo: null,
  opcao_pergunta: [],
  ...extra,
});

const OPCOES = [
  { id_opcao: 1, texto_opcao: 'Sim' },
  { id_opcao: 2, texto_opcao: 'Não' },
  { id_opcao: 3, texto_opcao: 'Às vezes' },
];

describe('RespostasService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let acesso: ReturnType<typeof criarDuble>;
  let service: RespostasService;

  const atendimentoNoBanco = (extra: Record<string, unknown> = {}) =>
    prisma.atendimento.findUnique.mockResolvedValue({
      id_atendimento: 1,
      id_usuario_paciente: paciente.id_usuario,
      id_situacao_atendimento: SA.INICIADO,
      atendimento_formulario: [{ id_formulario: 2 }],
      ...extra,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = criarPrismaMock();
    acesso = criarDuble();
    service = new RespostasService(prisma, acesso);
    atendimentoNoBanco();
    prisma.formulario.findUnique.mockResolvedValue({ id_formulario: 2 });
    prisma.formulario_paciente.findFirst.mockResolvedValue(FP);
    prisma.resposta.findMany.mockResolvedValue([]);
  });

  /** Regras comuns a iniciar, salvar e concluir. */
  describe.each([
    ['iniciar', (s: RespostasService, u = paciente) => s.iniciar(1, 2, u)],
    [
      'salvar',
      (s: RespostasService, u = paciente) =>
        s.salvar(1, 2, { respostas: [] }, u),
    ],
    ['concluir', (s: RespostasService, u = paciente) => s.concluir(1, 2, u)],
  ])('%s: pré-condições', (_nome, executar) => {
    it('só o paciente pode responder', async () => {
      await expect(executar(service, intermediario)).rejects.toThrow(
        'Apenas o paciente',
      );
    });

    it('responde 404 para atendimento inexistente', async () => {
      prisma.atendimento.findUnique.mockResolvedValue(null);
      await expect(executar(service)).rejects.toThrow(NotFoundException);
    });

    it('impede responder atendimento de outro paciente', async () => {
      atendimentoNoBanco({ id_usuario_paciente: 999 });
      await expect(executar(service)).rejects.toThrow(ForbiddenException);
    });

    it('recusa formulário não atribuído ao atendimento', async () => {
      atendimentoNoBanco({ atendimento_formulario: [{ id_formulario: 8 }] });
      await expect(executar(service)).rejects.toThrow('não está atribuído');
    });

    it.each([
      ['Avaliado', SA.AVALIADO],
      ['Encerrado', SA.ENCERRADO],
      ['Inativo', SA.INATIVO],
    ])('recusa atendimento %s', async (_situacao, id) => {
      atendimentoNoBanco({ id_situacao_atendimento: id });
      await expect(executar(service)).rejects.toThrow(
        'não aceita mais respostas',
      );
    });
  });

  describe('iniciar', () => {
    it('cria o preenchimento em rascunho e recalcula a situação', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValueOnce(null);
      await service.iniciar(1, 2, paciente);
      expect(
        prisma.formulario_paciente.create.mock.calls[0][0].data
          .situacao_formulario,
      ).toEqual({
        connect: { id_situacao_formulario: SF.RASCUNHO },
      });
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });

    it('não duplica o preenchimento já iniciado', async () => {
      await service.iniciar(1, 2, paciente);
      expect(prisma.formulario_paciente.create).not.toHaveBeenCalled();
    });

    it('tolera duas chamadas simultâneas (erro de unicidade)', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValueOnce(null);
      prisma.formulario_paciente.create.mockRejectedValue(erroPrisma('P2002'));
      await expect(service.iniciar(1, 2, paciente)).resolves.toBeDefined();
    });

    it('propaga outros erros do banco', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValueOnce(null);
      prisma.formulario_paciente.create.mockRejectedValue(
        new Error('falha de conexão'),
      );
      await expect(service.iniciar(1, 2, paciente)).rejects.toThrow(
        'falha de conexão',
      );
    });
  });

  describe('detalhar', () => {
    it('aplica a regra de acesso ao atendimento', async () => {
      acesso.exigirAcessoAtendimento.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(service.detalhar(1, 2, intermediario)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('responde 404 para formulário inexistente', async () => {
      prisma.formulario.findUnique.mockResolvedValue(null);
      await expect(service.detalhar(1, 2, paciente)).rejects.toThrow(
        'Formulário não encontrado',
      );
    });

    it('devolve lista vazia quando o preenchimento não começou', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue(null);
      await expect(service.detalhar(1, 2, paciente)).resolves.toMatchObject({
        formulario_paciente: null,
        respostas: [],
      });
      expect(prisma.resposta.findMany).not.toHaveBeenCalled();
    });

    it('devolve as respostas do preenchimento', async () => {
      prisma.resposta.findMany.mockResolvedValue([{ id_resposta: 1 }]);
      await expect(service.detalhar(1, 2, paciente)).resolves.toMatchObject({
        atendimento: { id_atendimento: 1 },
        respostas: [{ id_resposta: 1 }],
      });
    });
  });

  describe('salvar', () => {
    const perguntasDoFormulario = (
      ...perguntas: ReturnType<typeof pergunta>[]
    ) => prisma.pergunta.findMany.mockResolvedValue(perguntas);

    /** Respostas já gravadas: a 1ª consulta é a da reconciliação. */
    const respostasGravadas = (...linhas: Record<string, unknown>[]) =>
      prisma.resposta.findMany.mockResolvedValueOnce(linhas);

    const salvar = (...respostas: Record<string, unknown>[]) =>
      service.salvar(1, 2, { respostas } as never, paciente);

    const dadosCriados = () =>
      prisma.resposta.createManyAndReturn.mock.calls[0][0].data;

    beforeEach(() => {
      prisma.resposta.createManyAndReturn.mockImplementation(
        ({ data }: { data: unknown[] }) =>
          Promise.resolve(data.map((_l, i) => ({ id_resposta: 100 + i }))),
      );
    });

    it('exige iniciar o preenchimento antes', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue(null);
      await expect(salvar()).rejects.toThrow('Inicie o preenchimento');
    });

    it.each([
      ['Respondido', SF.RESPONDIDO],
      ['Em avaliação', SF.EM_AVALIACAO],
      ['Avaliado', SF.AVALIADO],
    ])('bloqueia alteração de formulário %s', async (_nome, situacao) => {
      prisma.formulario_paciente.findFirst.mockResolvedValue({
        ...FP,
        id_situacao_formulario: situacao,
      });
      await expect(salvar()).rejects.toThrow('não pode mais ser alterado');
    });

    it('recusa pergunta de outro formulário', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      await expect(
        salvar({ id_pergunta: 9, valor_texto: 'x' }),
      ).rejects.toThrow('não pertence a este formulário');
    });

    it('recusa tipo de pergunta não suportado', async () => {
      perguntasDoFormulario(pergunta(1, 99));
      await expect(salvar({ id_pergunta: 1 })).rejects.toThrow('não suportado');
    });

    it('grava resposta de texto', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas();
      await salvar({ id_pergunta: 1, valor_texto: 'Resposta' });
      expect(dadosCriados()).toEqual([
        {
          id_formulario_paciente: 50,
          id_pergunta: 1,
          id_usuario_pac: paciente.id_usuario,
          valor_texto: 'Resposta',
        },
      ]);
    });

    it('apaga a resposta de texto que foi esvaziada', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas({ id_resposta: 7, id_pergunta: 1 });
      await salvar({ id_pergunta: 1, valor_texto: '   ' });
      expect(prisma.resposta.deleteMany).toHaveBeenCalledWith({
        where: { id_resposta: { in: [7] } },
      });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it.each([
      ['abaixo do mínimo', -1, 'menor que 0'],
      ['acima do máximo', 11, 'maior que 10'],
    ])('recusa número %s', async (_nome, valor_numero, mensagem) => {
      perguntasDoFormulario(
        pergunta(1, T.NUMERO, { valor_minimo: 0, valor_maximo: 10 }),
      );
      await expect(salvar({ id_pergunta: 1, valor_numero })).rejects.toThrow(
        mensagem,
      );
    });

    it.each([0, 10])(
      'aceita o número no limite da faixa (%d)',
      async (valor_numero) => {
        perguntasDoFormulario(
          pergunta(1, T.NUMERO, { valor_minimo: 0, valor_maximo: 10 }),
        );
        respostasGravadas();
        await salvar({ id_pergunta: 1, valor_numero });
        expect(dadosCriados()[0].valor_numero).toBe(valor_numero);
      },
    );

    it('ignora número não informado', async () => {
      perguntasDoFormulario(pergunta(1, T.NUMERO));
      respostasGravadas();
      await salvar({ id_pergunta: 1 });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('grava o valor booleano falso', async () => {
      perguntasDoFormulario(pergunta(1, T.BOOLEANO));
      respostasGravadas();
      await salvar({ id_pergunta: 1, valor_binario: false });
      expect(dadosCriados()[0].valor_binario).toBe(false);
    });

    it('ignora booleano não informado', async () => {
      perguntasDoFormulario(pergunta(1, T.BOOLEANO));
      respostasGravadas();
      await salvar({ id_pergunta: 1, valor_binario: null });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('grava o id e o texto da opção na escolha única', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_UNICA, { opcao_pergunta: OPCOES }),
      );
      respostasGravadas();
      await salvar({ id_pergunta: 1, id_opcoes: [2] });
      expect(dadosCriados()[0]).toMatchObject({
        valor_numero: 2,
        valor_texto: 'Não',
      });
    });

    it('recusa mais de uma opção na escolha única', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_UNICA, { opcao_pergunta: OPCOES }),
      );
      await expect(
        salvar({ id_pergunta: 1, id_opcoes: [1, 2] }),
      ).rejects.toThrow('aceita apenas uma opção');
    });

    it('ignora escolha única sem opção', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_UNICA, { opcao_pergunta: OPCOES }),
      );
      respostasGravadas();
      await salvar({ id_pergunta: 1 });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('recusa opção que não pertence à pergunta', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_MULTIPLA, { opcao_pergunta: OPCOES }),
      );
      await expect(salvar({ id_pergunta: 1, id_opcoes: [99] })).rejects.toThrow(
        'não pertence à pergunta',
      );
    });

    it('na escolha múltipla, cria as novas, apaga as removidas e mantém as demais', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_MULTIPLA, { opcao_pergunta: OPCOES }),
      );
      respostasGravadas(
        { id_resposta: 11, id_pergunta: 1, valor_numero: 1 },
        { id_resposta: 12, id_pergunta: 1, valor_numero: 2 },
      );
      await salvar({ id_pergunta: 1, id_opcoes: [1, 3] });

      expect(prisma.resposta.deleteMany).toHaveBeenCalledWith({
        where: { id_resposta: { in: [12] } },
      });
      expect(
        dadosCriados().map((l: { valor_numero: number }) => l.valor_numero),
      ).toEqual([3]);
      expect(prisma.resposta.update).not.toHaveBeenCalled();
    });

    it('ignora escolha múltipla sem opções', async () => {
      perguntasDoFormulario(
        pergunta(1, T.ESCOLHA_MULTIPLA, { opcao_pergunta: OPCOES }),
      );
      respostasGravadas();
      await salvar({ id_pergunta: 1, id_opcoes: [] });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('atualiza a resposta existente mantendo o id_resposta', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas({ id_resposta: 7, id_pergunta: 1 });
      await salvar({ id_pergunta: 1, valor_texto: 'Novo texto' });
      expect(prisma.resposta.update).toHaveBeenCalledWith({
        where: { id_resposta: 7 },
        data: expect.objectContaining({
          valor_texto: 'Novo texto',
          dt_resposta: expect.any(Date),
        }),
      });
      expect(prisma.resposta.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('remove duplicatas antigas da mesma pergunta', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas(
        { id_resposta: 7, id_pergunta: 1 },
        { id_resposta: 8, id_pergunta: 1 },
      );
      await salvar({ id_pergunta: 1, valor_texto: 'Texto' });
      expect(prisma.resposta.deleteMany).toHaveBeenCalledWith({
        where: { id_resposta: { in: [8] } },
      });
    });

    it('acrescenta na trilha de auditoria cada valor salvo', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO), pergunta(2, T.TEXTO));
      respostasGravadas({ id_resposta: 7, id_pergunta: 1 });
      await salvar(
        { id_pergunta: 1, valor_texto: 'A' },
        { id_pergunta: 2, valor_texto: 'B' },
      );

      const { data } = prisma.log_respostas.createMany.mock.calls[0][0];
      expect(data).toEqual([
        expect.objectContaining({
          id_resposta: 7,
          id_pergunta: 1,
          valor_texto: 'A',
          id_usuario: paciente.id_usuario,
        }),
        expect.objectContaining({
          id_resposta: 100,
          id_pergunta: 2,
          valor_texto: 'B',
          id_usuario: paciente.id_usuario,
        }),
      ]);
    });

    it('não grava auditoria quando nada foi salvo', async () => {
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas();
      await salvar({ id_pergunta: 1, valor_texto: '' });
      expect(prisma.log_respostas.createMany).not.toHaveBeenCalled();
    });

    it('registra e propaga falha da transação', async () => {
      const logErro = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      perguntasDoFormulario(pergunta(1, T.TEXTO));
      respostasGravadas();
      prisma.$transaction.mockRejectedValue(new Error('transação abortada'));

      await expect(
        salvar({ id_pergunta: 1, valor_texto: 'x' }),
      ).rejects.toThrow('transação abortada');

      expect(logErro).toHaveBeenCalled();
      logErro.mockRestore();
    });
  });

  describe('concluir', () => {
    const obrigatorias = (...ids: number[]) =>
      prisma.pergunta.findMany.mockResolvedValue(
        ids.map((id_pergunta) => ({ id_pergunta, pergunta: 'P' })),
      );

    it('exige iniciar o preenchimento antes', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue(null);
      await expect(service.concluir(1, 2, paciente)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recusa formulário já concluído', async () => {
      prisma.formulario_paciente.findFirst.mockResolvedValue({
        ...FP,
        id_situacao_formulario: SF.RESPONDIDO,
      });
      await expect(service.concluir(1, 2, paciente)).rejects.toThrow(
        'já foi concluído',
      );
    });

    it('recusa quando falta pergunta obrigatória e informa a quantidade', async () => {
      obrigatorias(1, 2, 3);
      prisma.resposta.findMany.mockResolvedValueOnce([{ id_pergunta: 1 }]);
      await expect(service.concluir(1, 2, paciente)).rejects.toThrow(
        'Existem 2 pergunta(s) obrigatória(s)',
      );
      expect(prisma.formulario_paciente.update).not.toHaveBeenCalled();
    });

    it('marca "Respondido" e recalcula a situação do atendimento', async () => {
      obrigatorias(1);
      prisma.resposta.findMany.mockResolvedValueOnce([{ id_pergunta: 1 }]);
      await service.concluir(1, 2, paciente);
      expect(prisma.formulario_paciente.update).toHaveBeenCalledWith({
        where: { id_formulario_paciente: 50 },
        data: {
          situacao_formulario: {
            connect: { id_situacao_formulario: SF.RESPONDIDO },
          },
        },
      });
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });

    it('conclui formulário sem perguntas obrigatórias', async () => {
      obrigatorias();
      await expect(service.concluir(1, 2, paciente)).resolves.toBeDefined();
    });
  });
});
