import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  criarDuble,
  criarPrismaMock,
  erroPrisma,
  intermediario,
  maximo,
  paciente,
} from '../../test/helpers/dubles';
import { SituacaoAtendimento as S, TipoUsuario } from '../common/constants';
import { recalcularSituacaoAtendimento } from '../common/situacao-atendimento';
import { AtendimentosService } from './atendimentos.service';
import { OrdenarAtendimentoPor } from './dto/query-atendimento.dto';

jest.mock('../common/situacao-atendimento');

describe('AtendimentosService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let acesso: ReturnType<typeof criarDuble>;
  let service: AtendimentosService;

  const atendimentoBanco = (
    situacao: number = S.CRIADO,
    extra: Record<string, unknown> = {},
  ) => ({
    id_atendimento: 1,
    id_usuario_paciente: paciente.id_usuario,
    id_unidade_atendimento: 1,
    id_situacao_atendimento: situacao,
    atendimento_formulario: [{ id_formulario: 1 }],
    formulario_paciente: [],
    ...extra,
  });

  const noBanco = (situacao?: number, extra?: Record<string, unknown>) =>
    prisma.atendimento.findUnique.mockResolvedValue(
      atendimentoBanco(situacao, extra),
    );

  const pacienteAtivo = () =>
    prisma.usuario.findUnique.mockResolvedValue({
      id_tipo_usuario: TipoUsuario.PACIENTE,
      ativo: true,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = criarPrismaMock();
    acesso = criarDuble();
    service = new AtendimentosService(prisma, acesso);
    acesso.filtroAtendimentos.mockResolvedValue({});
    prisma.atendimento.update.mockResolvedValue(atendimentoBanco());
    prisma.formulario.findMany.mockResolvedValue([]);
  });

  describe('create', () => {
    const dto = {
      id_usuario_paciente: 10,
      id_unidade_atendimento: 1,
      descricao: 'Triagem',
      formularios: [1, 2],
    };

    beforeEach(() => {
      pacienteAtivo();
      prisma.atendimento.create.mockResolvedValue(atendimentoBanco());
    });

    it('bloqueia quem não é profissional', async () => {
      acesso.exigirProfissional.mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(service.create(dto, paciente)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.atendimento.create).not.toHaveBeenCalled();
    });

    it('verifica se o profissional pode usar a unidade', async () => {
      await service.create(dto, intermediario);
      expect(acesso.exigirUnidadePermitida).toHaveBeenCalledWith(
        intermediario,
        1,
      );
    });

    it.each([
      ['usuário inexistente', null, 'não é um paciente'],
      [
        'usuário que não é paciente',
        { id_tipo_usuario: TipoUsuario.MAXIMO, ativo: true },
        'não é um paciente',
      ],
      [
        'paciente inativo',
        { id_tipo_usuario: TipoUsuario.PACIENTE, ativo: false },
        'está inativo',
      ],
    ])('recusa %s', async (_nome, usuario, mensagem) => {
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      await expect(service.create(dto, maximo)).rejects.toThrow(mensagem);
    });

    it('recusa formulário desativado e informa o nome', async () => {
      prisma.formulario.findMany.mockResolvedValue([
        { id_formulario: 1, nome: 'SCARED' },
        { id_formulario: 2, nome: null },
      ]);
      await expect(service.create(dto, maximo)).rejects.toThrow('SCARED, #2');
    });

    it('cria em "Criado" com o profissional como autor e os formulários atribuídos', async () => {
      await service.create(dto, intermediario);
      const { data } = prisma.atendimento.create.mock.calls[0][0];
      expect(data.situacao_atendimento).toEqual({
        connect: { id_situacao_atendimento: S.CRIADO },
      });
      expect(data.usuario_atendimento_id_usuario_cadTousuario).toEqual({
        connect: { id_usuario: intermediario.id_usuario },
      });
      expect(data.atendimento_formulario.create).toHaveLength(2);
    });

    it.each(['P2025', 'P2003'])(
      'traduz o erro %s de relação inexistente',
      async (codigo) => {
        prisma.atendimento.create.mockRejectedValue(erroPrisma(codigo));
        await expect(service.create(dto, maximo)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('não mascara erro inesperado', async () => {
      prisma.atendimento.create.mockRejectedValue(new Error('falha de rede'));
      await expect(service.create(dto, maximo)).rejects.toThrow(
        'falha de rede',
      );
    });
  });

  describe('findAll', () => {
    const argumentos = () => prisma.atendimento.findMany.mock.calls[0][0];
    const filtro = () => argumentos().where.AND[1];

    beforeEach(() => {
      prisma.atendimento.findMany.mockResolvedValue([]);
      prisma.atendimento.count.mockResolvedValue(0);
    });

    it('usa página 1 e 10 itens por padrão', async () => {
      await expect(service.findAll({}, maximo)).resolves.toMatchObject({
        page: 1,
        limit: 10,
      });
      expect(argumentos()).toMatchObject({ skip: 0, take: 10 });
    });

    it('calcula o deslocamento e o total de páginas', async () => {
      prisma.atendimento.count.mockResolvedValue(11);
      await expect(
        service.findAll({ page: 3, limit: 5 }, maximo),
      ).resolves.toMatchObject({ total: 11, totalPages: 3 });
      expect(argumentos()).toMatchObject({ skip: 10, take: 5 });
    });

    it('aplica o escopo de visibilidade do usuário', async () => {
      acesso.filtroAtendimentos.mockResolvedValue({ id_usuario_paciente: 10 });
      await service.findAll({}, paciente);
      expect(argumentos().where.AND[0]).toEqual({ id_usuario_paciente: 10 });
    });

    it('filtra por unidades e situações, ignorando valores inválidos', async () => {
      await service.findAll(
        { unidades: '1, x, 2', situacoes: '3,abc' },
        maximo,
      );
      expect(filtro()).toEqual({
        id_unidade_atendimento: { in: [1, 2] },
        id_situacao_atendimento: { in: [3] },
      });
    });

    it('não filtra quando nenhum id da lista é válido', async () => {
      await service.findAll({ unidades: 'x', situacoes: 'y' }, maximo);
      expect(filtro()).toEqual({});
    });

    it('busca sem acentos quando a extensão unaccent existe', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 4 }, { id: 5 }]);
      await service.findAll({ search: ' joão ' }, maximo);
      expect(filtro()).toEqual({ id_atendimento: { in: [4, 5] } });
    });

    it('usa a busca comum quando a extensão unaccent falha', async () => {
      prisma.$queryRaw.mockRejectedValue(
        new Error('function unaccent does not exist'),
      );
      await service.findAll({ search: 'joão' }, maximo);
      expect(filtro().OR).toHaveLength(2);
      expect(filtro().OR[0]).toEqual({
        descricao: { contains: 'joão', mode: 'insensitive' },
      });
    });

    it('filtra pelo período informado', async () => {
      const data_inicio = '2026-01-01T03:00:00.000Z';
      const data_fim = '2026-02-01T02:59:59.000Z';
      await service.findAll({ data_inicio, data_fim }, maximo);
      expect(filtro().dt_cadastro).toEqual({
        gte: new Date(data_inicio),
        lte: new Date(data_fim),
      });
    });

    it('aceita período só com data final', async () => {
      const data_fim = '2026-02-01T02:59:59.000Z';
      await service.findAll({ data_fim }, maximo);
      expect(filtro().dt_cadastro).toEqual({ lte: new Date(data_fim) });
    });

    it.each([
      [OrdenarAtendimentoPor.DATA_ASC, { id_atendimento: 'asc' }],
      [OrdenarAtendimentoPor.SITUACAO, { id_situacao_atendimento: 'asc' }],
      [undefined, { id_atendimento: 'desc' }],
    ])('ordena por %s', async (ordenar_por, orderBy) => {
      await service.findAll({ ordenar_por }, maximo);
      expect(argumentos().orderBy).toEqual(orderBy);
    });

    it('acrescenta a situação do preenchimento a cada formulário', async () => {
      const preenchimento = {
        id_formulario: 1,
        id_situacao_formulario: 2,
        situacao_formulario: { nome: 'Respondido' },
      };
      prisma.atendimento.findMany.mockResolvedValue([
        atendimentoBanco(S.INICIADO, {
          atendimento_formulario: [{ id_formulario: 1 }, { id_formulario: 2 }],
          formulario_paciente: [preenchimento],
        }),
      ]);
      const { data } = await service.findAll({}, maximo);
      expect(data[0].atendimento_formulario).toEqual([
        { id_formulario: 1, status_formulario_paciente: preenchimento },
        { id_formulario: 2, status_formulario_paciente: null },
      ]);
      expect(data[0]).not.toHaveProperty('formulario_paciente');
    });
  });

  describe('findOne', () => {
    it('responde 404 quando não existe', async () => {
      prisma.atendimento.findUnique.mockResolvedValue(null);
      await expect(service.findOne(1, maximo)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('aplica a regra de visibilidade', async () => {
      noBanco();
      acesso.exigirAcessoAtendimento.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(service.findOne(1, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('devolve o atendimento quando o acesso é permitido', async () => {
      noBanco();
      await expect(service.findOne(1, maximo)).resolves.toMatchObject({
        id_atendimento: 1,
      });
    });
  });

  describe('update', () => {
    it('recusa trocar o paciente fora de "Criado"', async () => {
      noBanco(S.INICIADO);
      await expect(
        service.update(1, { id_usuario_paciente: 99 }, maximo),
      ).rejects.toThrow('troca de paciente');
    });

    it('valida o novo paciente em "Criado"', async () => {
      noBanco();
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(
        service.update(1, { id_usuario_paciente: 99 }, maximo),
      ).rejects.toThrow('não é um paciente');
    });

    it('troca o paciente em "Criado"', async () => {
      noBanco();
      pacienteAtivo();
      await service.update(1, { id_usuario_paciente: 99 }, maximo);
      expect(
        prisma.atendimento.update.mock.calls[0][0].data
          .usuario_atendimento_id_usuario_pacienteTousuario,
      ).toEqual({
        connect: { id_usuario: 99 },
      });
    });

    it('permite reenviar o mesmo paciente em qualquer situação', async () => {
      noBanco(S.INICIADO);
      await expect(
        service.update(1, { id_usuario_paciente: paciente.id_usuario }, maximo),
      ).resolves.toBeDefined();
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('verifica permissão ao mudar a unidade', async () => {
      noBanco();
      await service.update(1, { id_unidade_atendimento: 2 }, intermediario);
      expect(acesso.exigirUnidadePermitida).toHaveBeenCalledWith(
        intermediario,
        2,
      );
      expect(
        prisma.atendimento.update.mock.calls[0][0].data.unidade_atendimento,
      ).toEqual({
        connect: { id_unidade_atendimento: 2 },
      });
    });

    it('traduz erro de relação inexistente', async () => {
      noBanco();
      prisma.atendimento.update.mockRejectedValue(erroPrisma('P2003'));
      await expect(
        service.update(1, { descricao: 'x' }, maximo),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('atribuirFormularios', () => {
    it.each([
      ['Avaliado', S.AVALIADO],
      ['Encerrado', S.ENCERRADO],
      ['Inativo', S.INATIVO],
    ])('recusa em atendimento %s', async (_nome, situacao) => {
      noBanco(situacao);
      await expect(
        service.atribuirFormularios(1, { formularios: [2] }, maximo),
      ).rejects.toThrow('Não é possível atribuir');
    });

    it('recusa quando todos já estão atribuídos', async () => {
      noBanco();
      await expect(
        service.atribuirFormularios(1, { formularios: [1] }, maximo),
      ).rejects.toThrow('já estão atribuídos');
    });

    it('atribui só os novos e recalcula a situação', async () => {
      noBanco(S.RESPONDIDO);
      await service.atribuirFormularios(
        1,
        { formularios: [1, 2] },
        intermediario,
      );
      expect(prisma.atendimento_formulario.createMany).toHaveBeenCalledWith({
        data: [
          {
            id_atendimento: 1,
            id_formulario: 2,
            id_usuario_atribuicao: intermediario.id_usuario,
          },
        ],
      });
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });

    it('traduz erro de formulário inexistente', async () => {
      noBanco();
      prisma.atendimento_formulario.createMany.mockRejectedValue(
        erroPrisma('P2003'),
      );
      await expect(
        service.atribuirFormularios(1, { formularios: [2] }, maximo),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removerFormulario', () => {
    it('recusa fora de "Criado"', async () => {
      noBanco(S.INICIADO);
      await expect(service.removerFormulario(1, 1, maximo)).rejects.toThrow(
        'Só é possível remover',
      );
      expect(prisma.atendimento_formulario.deleteMany).not.toHaveBeenCalled();
    });

    it('remove e recalcula a situação', async () => {
      noBanco();
      await service.removerFormulario(1, 1, maximo);
      expect(prisma.atendimento_formulario.deleteMany).toHaveBeenCalledWith({
        where: { id_atendimento: 1, id_formulario: 1 },
      });
      expect(recalcularSituacaoAtendimento).toHaveBeenCalledWith(prisma, 1);
    });
  });

  describe('encerrar', () => {
    it('recusa quando o atendimento não está "Avaliado"', async () => {
      noBanco(S.EM_AVALIACAO);
      await expect(service.encerrar(1, maximo)).rejects.toThrow(
        'só pode ser encerrado',
      );
    });

    it('encerra atendimento "Avaliado"', async () => {
      noBanco(S.AVALIADO);
      await service.encerrar(1, maximo);
      expect(prisma.atendimento.update.mock.calls[0][0].data).toEqual({
        situacao_atendimento: {
          connect: { id_situacao_atendimento: S.ENCERRADO },
        },
      });
    });
  });

  describe('inativar', () => {
    it('recusa atendimento encerrado', async () => {
      noBanco(S.ENCERRADO);
      await expect(service.inativar(1, maximo)).rejects.toThrow(
        'não pode ser inativado',
      );
    });

    it('inativa atendimento em andamento', async () => {
      noBanco(S.INICIADO);
      await service.inativar(1, maximo);
      expect(prisma.atendimento.update.mock.calls[0][0].data).toEqual({
        situacao_atendimento: {
          connect: { id_situacao_atendimento: S.INATIVO },
        },
      });
    });
  });
});
