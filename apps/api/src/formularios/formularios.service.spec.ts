import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  criarPrismaMock,
  erroPrisma,
  intermediario,
  paciente,
} from '../../test/helpers/dubles';
import { TipoPergunta as T } from '../common/constants';
import { OrdenarFormularioPor } from './dto/query-formulario.dto';
import { FormulariosService } from './formularios.service';

describe('FormulariosService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: FormulariosService;

  const duasOpcoes = [
    { texto_opcao: 'Sim', valor_opcao: 1 },
    { texto_opcao: 'Não', valor_opcao: 0 },
  ];
  const perguntaTexto = {
    pergunta: 'Como você está?',
    id_tipo_pergunta: T.TEXTO,
  };
  const perguntaEscolha = {
    pergunta: 'Dorme bem?',
    id_tipo_pergunta: T.ESCOLHA_UNICA,
    opcoes: duasOpcoes,
  };

  const perguntaNoBanco = (id_formulario = 1) =>
    prisma.pergunta.findUnique.mockResolvedValue({
      id_pergunta: 5,
      id_formulario,
    });

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new FormulariosService(prisma);
    prisma.formulario.findUnique.mockResolvedValue({ id_formulario: 1 });
    prisma.resposta.count.mockResolvedValue(0);
  });

  describe.each<[string, (s: FormulariosService) => Promise<unknown>]>([
    ['create', (s) => s.create({ id_tipo_formulario: 1, nome: 'F' }, paciente)],
    ['update', (s) => s.update(1, {}, paciente)],
    ['desativar', (s) => s.desativar(1, paciente)],
    ['reativar', (s) => s.reativar(1, paciente)],
    ['addPergunta', (s) => s.addPergunta(1, perguntaTexto, paciente)],
    ['updatePergunta', (s) => s.updatePergunta(1, 5, {}, paciente)],
    ['removePergunta', (s) => s.removePergunta(1, 5, paciente)],
  ])('%s', (_nome, executar) => {
    it('bloqueia paciente', async () => {
      await expect(executar(service)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    const dto = (perguntas?: unknown[]) =>
      ({ id_tipo_formulario: 1, nome: 'SCARED', perguntas }) as never;

    it('recusa pergunta de escolha com menos de 2 opções', async () => {
      await expect(
        service.create(
          dto([{ ...perguntaEscolha, opcoes: [duasOpcoes[0]] }]),
          intermediario,
        ),
      ).rejects.toThrow('pelo menos 2 opções');
    });

    it('recusa pergunta de escolha sem opções', async () => {
      await expect(
        service.create(
          dto([{ pergunta: 'x', id_tipo_pergunta: T.ESCOLHA_MULTIPLA }]),
          intermediario,
        ),
      ).rejects.toThrow('pelo menos 2 opções');
    });

    it('recusa opções em pergunta que não é de escolha', async () => {
      await expect(
        service.create(
          dto([{ ...perguntaTexto, opcoes: duasOpcoes }]),
          intermediario,
        ),
      ).rejects.toThrow('Apenas perguntas de escolha');
    });

    it('cria perguntas obrigatórias por padrão, com opções e autor', async () => {
      await service.create(
        dto([perguntaTexto, perguntaEscolha]),
        intermediario,
      );
      const criadas =
        prisma.formulario.create.mock.calls[0][0].data.pergunta.create;
      expect(criadas[0]).toMatchObject({
        obrigatoria: true,
        usuario: { connect: { id_usuario: intermediario.id_usuario } },
      });
      expect(criadas[0]).not.toHaveProperty('opcao_pergunta');
      expect(criadas[1].opcao_pergunta.create).toHaveLength(2);
    });

    it('respeita pergunta marcada como opcional', async () => {
      await service.create(
        dto([{ ...perguntaTexto, obrigatoria: false }]),
        intermediario,
      );
      expect(
        prisma.formulario.create.mock.calls[0][0].data.pergunta.create[0]
          .obrigatoria,
      ).toBe(false);
    });

    it('aceita formulário sem perguntas', async () => {
      await service.create(dto(), intermediario);
      expect(
        prisma.formulario.create.mock.calls[0][0].data.pergunta.create,
      ).toEqual([]);
    });

    it.each(['P2025', 'P2003'])(
      'traduz o erro %s de tipo inexistente',
      async (codigo) => {
        prisma.formulario.create.mockRejectedValue(erroPrisma(codigo));
        await expect(service.create(dto(), intermediario)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('não mascara erro inesperado', async () => {
      prisma.formulario.create.mockRejectedValue(new Error('falha'));
      await expect(service.create(dto(), intermediario)).rejects.toThrow(
        'falha',
      );
    });
  });

  describe('findAll', () => {
    const argumentos = () => prisma.formulario.findMany.mock.calls[0][0];

    beforeEach(() => {
      prisma.formulario.findMany.mockResolvedValue([]);
      prisma.formulario.count.mockResolvedValue(21);
    });

    it('pagina o resultado', async () => {
      await expect(
        service.findAll({ page: 2, limit: 10 }),
      ).resolves.toMatchObject({ total: 21, totalPages: 3 });
      expect(argumentos()).toMatchObject({ skip: 10, take: 10 });
    });

    it('busca sem acentos quando a extensão existe', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 3 }]);
      await service.findAll({ search: 'ansiedade' });
      expect(argumentos().where).toEqual({ id_formulario: { in: [3] } });
    });

    it('usa a busca comum quando a extensão falha', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('sem unaccent'));
      await service.findAll({ search: 'ansiedade' });
      expect(argumentos().where).toEqual({
        nome: { contains: 'ansiedade', mode: 'insensitive' },
      });
    });

    it('filtra por tipo e por formulários desativados', async () => {
      await service.findAll({ id_tipo_formulario: 2, ativo: false });
      expect(argumentos().where).toEqual({
        id_tipo_formulario: 2,
        ativo: false,
      });
    });

    it('filtra pelo período informado', async () => {
      const data_inicio = '2026-01-01T03:00:00.000Z';
      await service.findAll({ data_inicio });
      expect(argumentos().where.dt_cadastro).toEqual({
        gte: new Date(data_inicio),
      });
    });

    it.each([
      [OrdenarFormularioPor.NOME, { nome: 'asc' }],
      [
        OrdenarFormularioPor.MAIS_RESPONDIDOS,
        { formulario_paciente: { _count: 'desc' } },
      ],
      [undefined, { id_formulario: 'desc' }],
    ])('ordena por %s', async (ordenar_por, orderBy) => {
      await service.findAll({ ordenar_por });
      expect(argumentos().orderBy).toEqual(orderBy);
    });
  });

  describe('findOne', () => {
    it('responde 404 quando não existe', async () => {
      prisma.formulario.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });

    it('devolve o formulário', async () => {
      await expect(service.findOne(1)).resolves.toEqual({ id_formulario: 1 });
    });
  });

  describe('update', () => {
    it('altera o tipo quando informado', async () => {
      await service.update(1, { id_tipo_formulario: 3 }, intermediario);
      expect(
        prisma.formulario.update.mock.calls[0][0].data.tipo_formulario,
      ).toEqual({
        connect: { id_tipo_formulario: 3 },
      });
    });

    it('mantém o tipo quando não informado', async () => {
      await service.update(1, { nome: 'Novo' }, intermediario);
      expect(prisma.formulario.update.mock.calls[0][0].data).not.toHaveProperty(
        'tipo_formulario',
      );
    });

    it('traduz erro de tipo inexistente', async () => {
      prisma.formulario.update.mockRejectedValue(erroPrisma('P2025'));
      await expect(
        service.update(1, { id_tipo_formulario: 3 }, intermediario),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it.each([
    ['desativar', false],
    ['reativar', true],
  ] as const)('%s altera o indicador de ativo', async (metodo, ativo) => {
    await service[metodo](1, intermediario);
    expect(prisma.formulario.update.mock.calls[0][0].data).toEqual({ ativo });
  });

  describe('addPergunta', () => {
    it('recusa quando o formulário já tem respostas', async () => {
      prisma.resposta.count.mockResolvedValue(1);
      await expect(
        service.addPergunta(1, perguntaTexto as never, intermediario),
      ).rejects.toThrow('já possui respostas');
    });

    it('valida as opções da nova pergunta', async () => {
      await expect(
        service.addPergunta(
          1,
          { ...perguntaEscolha, opcoes: [] },
          intermediario,
        ),
      ).rejects.toThrow('pelo menos 2 opções');
    });

    it('cria a pergunta ligada ao formulário', async () => {
      await service.addPergunta(1, perguntaTexto, intermediario);
      expect(prisma.pergunta.create.mock.calls[0][0].data.formulario).toEqual({
        connect: { id_formulario: 1 },
      });
    });

    it('traduz erro de tipo inexistente', async () => {
      prisma.pergunta.create.mockRejectedValue(erroPrisma('P2003'));
      await expect(
        service.addPergunta(1, perguntaTexto as never, intermediario),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updatePergunta', () => {
    it.each([
      ['inexistente', null],
      ['de outro formulário', { id_pergunta: 5, id_formulario: 99 }],
    ])('responde 404 para pergunta %s', async (_nome, pergunta) => {
      prisma.pergunta.findUnique.mockResolvedValue(pergunta);
      await expect(
        service.updatePergunta(1, 5, {}, intermediario),
      ).rejects.toThrow(NotFoundException);
    });

    it('recusa editar pergunta já respondida', async () => {
      perguntaNoBanco();
      prisma.resposta.count.mockResolvedValue(1);
      await expect(
        service.updatePergunta(1, 5, {}, intermediario),
      ).rejects.toThrow('já foi respondida');
    });

    it('valida as opções ao mudar o tipo', async () => {
      perguntaNoBanco();
      await expect(
        service.updatePergunta(
          1,
          5,
          { id_tipo_pergunta: T.ESCOLHA_UNICA },
          intermediario,
        ),
      ).rejects.toThrow('pelo menos 2 opções');
    });

    it('substitui o conjunto de opções', async () => {
      perguntaNoBanco();
      await service.updatePergunta(
        1,
        5,
        { id_tipo_pergunta: T.ESCOLHA_UNICA, opcoes: duasOpcoes },
        intermediario,
      );
      expect(prisma.opcao_pergunta.deleteMany).toHaveBeenCalledWith({
        where: { id_pergunta: 5 },
      });
      expect(
        prisma.opcao_pergunta.createMany.mock.calls[0][0].data,
      ).toHaveLength(2);
    });

    it('apaga as opções quando a lista vem vazia', async () => {
      perguntaNoBanco();
      await service.updatePergunta(
        1,
        5,
        { id_tipo_pergunta: T.TEXTO, opcoes: [] },
        intermediario,
      );
      expect(prisma.opcao_pergunta.deleteMany).toHaveBeenCalled();
      expect(prisma.opcao_pergunta.createMany).not.toHaveBeenCalled();
    });

    it('não mexe nas opções quando elas não vêm no pedido', async () => {
      perguntaNoBanco();
      await service.updatePergunta(
        1,
        5,
        { pergunta: 'Novo enunciado' },
        intermediario,
      );
      expect(prisma.pergunta.update.mock.calls[0][0].data.pergunta).toBe(
        'Novo enunciado',
      );
      expect(prisma.opcao_pergunta.deleteMany).not.toHaveBeenCalled();
    });

    it('traduz erro de tipo inexistente', async () => {
      perguntaNoBanco();
      prisma.$transaction.mockRejectedValue(erroPrisma('P2025'));
      await expect(
        service.updatePergunta(1, 5, {}, intermediario),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removePergunta', () => {
    it('responde 404 para pergunta inexistente', async () => {
      prisma.pergunta.findUnique.mockResolvedValue(null);
      await expect(service.removePergunta(1, 5, intermediario)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('recusa excluir pergunta já respondida', async () => {
      perguntaNoBanco();
      prisma.resposta.count.mockResolvedValue(2);
      await expect(service.removePergunta(1, 5, intermediario)).rejects.toThrow(
        'já foi respondida',
      );
      expect(prisma.pergunta.delete).not.toHaveBeenCalled();
    });

    it('exclui as opções e a pergunta', async () => {
      perguntaNoBanco();
      await service.removePergunta(1, 5, intermediario);
      expect(prisma.opcao_pergunta.deleteMany).toHaveBeenCalledWith({
        where: { id_pergunta: 5 },
      });
      expect(prisma.pergunta.delete).toHaveBeenCalledWith({
        where: { id_pergunta: 5 },
      });
    });
  });
});
