import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  criarDuble,
  criarPrismaMock,
  erroPrisma,
  intermediario,
  maximo,
} from '../../test/helpers/dubles';
import {
  expiracaoSenhaProvisoria,
  gerarSenhaProvisoria,
  hashSenha,
} from '../acesso/senha';
import {
  AcaoGestao,
  SituacaoUsuario as S,
  TipoUsuario as T,
} from '../common/constants';
import { GestaoUsuariosService } from './gestao-usuarios.service';

jest.mock('../acesso/senha');

const SENHA = 'Prov@2026abc';
const EXPIRA = new Date('2026-11-10T12:00:00.000Z');

const usuarioBanco = (extra: Record<string, unknown> = {}) => ({
  id_usuario: 5,
  nome: 'Ana Lima',
  email: 'ana@pasi.test',
  cpf: '12345678900',
  id_tipo_usuario: T.INTERMEDIARIO,
  id_situacao_usuario: S.DEFERIDO,
  ativo: true,
  tipo_usuario: { nome: 'Intermediário' },
  situacao_usuario: { nome: 'Deferido' },
  profissao: null,
  senha_hash: 'hash',
  senha_reset_token: 'token',
  senha_reset_expira_em: null,
  senha_provisoria_expira_em: null,
  dt_cadastro: new Date('2026-01-01'),
  ...extra,
});

describe('GestaoUsuariosService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let mail: ReturnType<typeof criarDuble>;
  let acesso: ReturnType<typeof criarDuble>;
  let log: ReturnType<typeof criarDuble>;
  let vinculos: ReturnType<typeof criarDuble>;
  let service: GestaoUsuariosService;

  const noBanco = (extra?: Record<string, unknown>) =>
    prisma.usuario.findUnique.mockResolvedValue(usuarioBanco(extra));

  beforeEach(() => {
    prisma = criarPrismaMock();
    mail = criarDuble();
    acesso = criarDuble();
    log = criarDuble();
    vinculos = criarDuble();
    service = new GestaoUsuariosService(prisma, mail, acesso, log, vinculos);

    jest.mocked(gerarSenhaProvisoria).mockReturnValue(SENHA);
    jest.mocked(expiracaoSenhaProvisoria).mockReturnValue(EXPIRA);
    jest.mocked(hashSenha).mockResolvedValue('hash-novo');
    mail.enviarSenhaProvisoria.mockResolvedValue(true);
    vinculos.listar.mockResolvedValue([]);
    prisma.log_adm_geral.findMany.mockResolvedValue([]);
    prisma.log_adm_geral.findFirst.mockResolvedValue(null);
    noBanco();
  });

  describe.each<[string, (s: GestaoUsuariosService) => Promise<unknown>]>([
    ['listar', (s) => s.listar({}, intermediario)],
    ['detalhar', (s) => s.detalhar(5, intermediario)],
    [
      'cadastrarProfissional',
      (s) => s.cadastrarProfissional({ unidades: [] } as never, intermediario),
    ],
    ['reenviarSenha', (s) => s.reenviarSenha(5, intermediario)],
    ['corrigirEmail', (s) => s.corrigirEmail(5, 'a@b.com', intermediario)],
    ['inativar', (s) => s.inativar(5, intermediario)],
    ['reativar', (s) => s.reativar(5, intermediario)],
    ['promover', (s) => s.promover(5, intermediario)],
    ['vincularUnidade', (s) => s.vincularUnidade(5, 1, false, intermediario)],
    ['desvincularUnidade', (s) => s.desvincularUnidade(5, 1, intermediario)],
    ['trocarSede', (s) => s.trocarSede(5, 1, intermediario)],
  ])('%s', (_nome, executar) => {
    it('é exclusivo do perfil máximo', async () => {
      acesso.exigirMaximo.mockImplementation(() => {
        throw new ForbiddenException();
      });
      await expect(executar(service)).rejects.toThrow(ForbiddenException);
    });
  });

  describe.each<[string, (s: GestaoUsuariosService) => Promise<unknown>]>([
    ['detalhar', (s) => s.detalhar(5, maximo)],
    ['reenviarSenha', (s) => s.reenviarSenha(5, maximo)],
    ['corrigirEmail', (s) => s.corrigirEmail(5, 'a@b.com', maximo)],
    ['inativar', (s) => s.inativar(5, maximo)],
    ['reativar', (s) => s.reativar(5, maximo)],
    ['promover', (s) => s.promover(5, maximo)],
    ['vincularUnidade', (s) => s.vincularUnidade(5, 1, false, maximo)],
  ])('%s', (_nome, executar) => {
    it('responde 404 para usuário inexistente', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(executar(service)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listar', () => {
    const argumentos = () => prisma.usuario.findMany.mock.calls[0][0];

    beforeEach(() => {
      prisma.usuario.findMany.mockResolvedValue([]);
      prisma.usuario.count.mockResolvedValue(0);
      prisma.usuario.groupBy.mockResolvedValue([]);
    });

    it('usa página 1 e 20 itens por padrão, ordenando por nome', async () => {
      await service.listar({}, maximo);
      expect(argumentos()).toMatchObject({
        skip: 0,
        take: 20,
        orderBy: { nome: 'asc' },
      });
    });

    it('aplica filtros de perfil, acesso e profissão', async () => {
      await service.listar(
        { perfil: 'paciente', acesso: 'inativos', id_profissao: 3 } as never,
        maximo,
      );
      expect(argumentos().where).toEqual({
        id_tipo_usuario: T.PACIENTE,
        ativo: false,
        id_profissao: 3,
      });
    });

    it('filtra usuários ativos', async () => {
      await service.listar({ acesso: 'ativos' } as never, maximo);
      expect(argumentos().where).toEqual({ ativo: true });
    });

    it('não aplica a situação escolhida à contagem das abas', async () => {
      await service.listar({ situacao: S.DEFERIDO }, maximo);
      expect(argumentos().where).toEqual({ id_situacao_usuario: S.DEFERIDO });
      expect(prisma.usuario.groupBy.mock.calls[0][0].where).toEqual({});
    });

    it('busca por nome sem acento, e-mail e CPF', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      await service.listar({ search: '123.4' }, maximo);
      expect(argumentos().where.OR).toEqual([
        { id_usuario: { in: [1] } },
        { email: { contains: '123.4' } },
        { cpf: { contains: '1234' } },
      ]);
    });

    it('usa busca comum e dispensa CPF em termo sem dígitos', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('sem unaccent'));
      await service.listar({ search: 'Ana' }, maximo);
      expect(argumentos().where.OR).toEqual([
        { nome: { contains: 'Ana', mode: 'insensitive' } },
        { email: { contains: 'ana' } },
      ]);
    });

    it.each([
      ['recentes', { id_usuario: 'desc' }],
      ['antigos', { id_usuario: 'asc' }],
    ])('ordena por %s', async (ordenar, orderBy) => {
      await service.listar({ ordenar } as never, maximo);
      expect(argumentos().orderBy).toEqual(orderBy);
    });

    it('conta os usuários por situação', async () => {
      prisma.usuario.groupBy.mockResolvedValue([
        { id_situacao_usuario: S.PENDENCIA_I, _count: { _all: 2 } },
        { id_situacao_usuario: S.PENDENCIA_II, _count: { _all: 3 } },
        { id_situacao_usuario: S.DEFERIDO, _count: { _all: 5 } },
      ]);
      await expect(service.listar({}, maximo)).resolves.toMatchObject({
        contagem: { todos: 10, pendencia_i: 2, pendencia_ii: 3, deferido: 5 },
      });
    });

    it('informa a data da inativação mais recente', async () => {
      const recente = new Date('2026-03-01');
      prisma.usuario.findMany.mockResolvedValue([
        usuarioBanco({ ativo: false }),
      ]);
      prisma.log_adm_geral.findMany.mockResolvedValue([
        { id_usuario_alvo: 5, dt_hora_acao: recente },
        { id_usuario_alvo: 5, dt_hora_acao: new Date('2026-01-01') },
      ]);
      const { data } = await service.listar({}, maximo);
      expect(data[0].inativado_em).toEqual(recente);
    });

    it.each([
      [
        'intermediário em Pendência I',
        { id_situacao_usuario: S.PENDENCIA_I },
        {
          somente_leitura: false,
          reenviar_senha: true,
          corrigir_email: true,
          promover: true,
          inativar: true,
          reativar: false,
          gerir_unidades: true,
        },
      ],
      [
        'outro máximo',
        { id_tipo_usuario: T.MAXIMO },
        {
          somente_leitura: true,
          reenviar_senha: false,
          corrigir_email: false,
          promover: false,
          inativar: false,
          reativar: false,
          gerir_unidades: false,
        },
      ],
      [
        'o próprio máximo',
        { id_tipo_usuario: T.MAXIMO, id_usuario: maximo.id_usuario },
        {
          somente_leitura: false,
          reenviar_senha: false,
          corrigir_email: false,
          promover: false,
          inativar: false,
          reativar: false,
          gerir_unidades: false,
        },
      ],
      [
        'paciente inativo',
        { id_tipo_usuario: T.PACIENTE, ativo: false },
        {
          somente_leitura: false,
          reenviar_senha: false,
          corrigir_email: false,
          promover: false,
          inativar: false,
          reativar: true,
          gerir_unidades: false,
        },
      ],
    ])('calcula as permissões sobre %s', async (_nome, extra, permissoes) => {
      prisma.usuario.findMany.mockResolvedValue([usuarioBanco(extra)]);
      const { data } = await service.listar({}, maximo);
      expect(data[0].permissoes).toEqual(permissoes);
    });
  });

  describe('detalhar', () => {
    it('não expõe dados sigilosos', async () => {
      const r = await service.detalhar(5, maximo);
      expect(r).not.toHaveProperty('senha_hash');
      expect(r).not.toHaveProperty('senha_reset_token');
      expect(r).not.toHaveProperty('senha_reset_expira_em');
    });

    it('lista as unidades do profissional', async () => {
      vinculos.listar.mockResolvedValue([{ id_usuario_unidade: 1 }]);
      await expect(service.detalhar(5, maximo)).resolves.toMatchObject({
        perfil: 'Intermediário',
        unidades: [{ id_usuario_unidade: 1 }],
      });
    });

    it('não consulta unidades de paciente', async () => {
      noBanco({ id_tipo_usuario: T.PACIENTE });
      await expect(service.detalhar(5, maximo)).resolves.toMatchObject({
        perfil: 'Paciente',
        unidades: [],
      });
      expect(vinculos.listar).not.toHaveBeenCalled();
    });

    it('monta o histórico e indica quem cadastrou', async () => {
      const autor = { id_usuario: 1, nome: 'Gestor' };
      prisma.log_adm_geral.findFirst.mockResolvedValue({ usuario: autor });
      prisma.log_adm_geral.findMany.mockResolvedValue([
        {
          id_log_adm_geral: 9,
          dt_hora_acao: EXPIRA,
          acao: { nome: 'Promover' },
          detalhe: 'x',
          usuario: autor,
        },
      ]);
      await expect(service.detalhar(5, maximo)).resolves.toMatchObject({
        cadastrado_por: autor,
        historico: [
          { id: 9, data: EXPIRA, acao: 'Promover', detalhe: 'x', por: autor },
        ],
      });
    });

    it('informa quando o usuário foi inativado', async () => {
      noBanco({ ativo: false });
      // A mesma consulta alimenta o histórico e a data de inativação.
      prisma.log_adm_geral.findMany.mockResolvedValue([
        {
          id_log_adm_geral: 1,
          id_usuario_alvo: 5,
          dt_hora_acao: EXPIRA,
          acao: { nome: AcaoGestao.INATIVAR },
        },
      ]);
      const r = await service.detalhar(5, maximo);
      expect(r.inativado_em).toEqual(EXPIRA);
    });
  });

  describe('cadastrarProfissional', () => {
    const dto = (extra: Record<string, unknown> = {}) =>
      ({
        nome: ' Rafael Oliveira ',
        cpf: '21488741030',
        email: ' Rafael@Email.com ',
        tel_celular: '11977771020',
        sexo: 'M',
        id_profissao: 1,
        perfil: 'intermediario',
        unidades: [
          { id_unidade_atendimento: 1, sede: true },
          { id_unidade_atendimento: 2, sede: false },
        ],
        ...extra,
      }) as never;

    beforeEach(() => {
      prisma.unidade_atendimento.count.mockResolvedValue(2);
      prisma.unidade_atendimento.findUnique.mockResolvedValue({
        nome: 'CRAS Centro',
      });
      prisma.usuario.create.mockResolvedValue({
        id_usuario: 5,
        nome: 'Rafael Oliveira',
        email: 'rafael@email.com',
      });
    });

    it('recusa unidade repetida', async () => {
      const unidades = [
        { id_unidade_atendimento: 1, sede: true },
        { id_unidade_atendimento: 1, sede: false },
      ];
      await expect(
        service.cadastrarProfissional(dto({ unidades }), maximo),
      ).rejects.toThrow('mais de uma vez');
    });

    it.each([
      ['nenhuma sede', [false, false]],
      ['duas sedes', [true, true]],
    ])('recusa %s', async (_nome, [a, b]) => {
      const unidades = [
        { id_unidade_atendimento: 1, sede: a },
        { id_unidade_atendimento: 2, sede: b },
      ];
      await expect(
        service.cadastrarProfissional(dto({ unidades }), maximo),
      ).rejects.toThrow('exatamente uma unidade');
    });

    it('recusa unidade inexistente', async () => {
      prisma.unidade_atendimento.count.mockResolvedValue(1);
      await expect(
        service.cadastrarProfissional(dto(), maximo),
      ).rejects.toThrow('não existe');
    });

    it('cria em Pendência I, com dados normalizados e só o hash da senha', async () => {
      await service.cadastrarProfissional(dto(), maximo);
      const { data } = prisma.usuario.create.mock.calls[0][0];
      expect(data).toMatchObject({
        nome: 'Rafael Oliveira',
        email: 'rafael@email.com',
        senha_hash: 'hash-novo',
        senha_provisoria_expira_em: EXPIRA,
        tipo_usuario: { connect: { id_tipo_usuario: T.INTERMEDIARIO } },
        situacao_usuario: { connect: { id_situacao_usuario: S.PENDENCIA_I } },
      });
      expect(JSON.stringify(data)).not.toContain(SENHA);
    });

    it('cria perfil máximo quando solicitado', async () => {
      await service.cadastrarProfissional(
        dto({ perfil: 'maximo', id_genero: 2 }),
        maximo,
      );
      expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({
        tipo_usuario: { connect: { id_tipo_usuario: T.MAXIMO } },
        genero: { connect: { id_genero: 2 } },
      });
    });

    it('vincula as unidades e registra o log', async () => {
      await service.cadastrarProfissional(dto(), maximo);
      expect(
        prisma.usuario_unidade.createMany.mock.calls[0][0].data,
      ).toHaveLength(2);
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: AcaoGestao.CADASTRAR,
          idAutor: maximo.id_usuario,
          idAlvo: 5,
          detalhe: expect.stringContaining('sede CRAS Centro'),
        }),
        prisma,
      );
    });

    it('envia a senha em texto puro apenas por e-mail', async () => {
      await expect(
        service.cadastrarProfissional(dto(), maximo),
      ).resolves.toMatchObject({
        email_enviado: true,
        senha_provisoria_expira_em: EXPIRA,
      });
      expect(mail.enviarSenhaProvisoria).toHaveBeenCalledWith(
        'rafael@email.com',
        'Rafael Oliveira',
        SENHA,
        EXPIRA,
      );
    });

    it('informa quando o e-mail não pôde ser enviado', async () => {
      mail.enviarSenhaProvisoria.mockResolvedValue(false);
      await expect(
        service.cadastrarProfissional(dto(), maximo),
      ).resolves.toMatchObject({ email_enviado: false });
    });

    it.each([
      [['cpf'], 'CPF'],
      [['email'], 'e-mail'],
      [['tel_celular'], 'celular'],
      [['outro'], 'dado'],
    ])('traduz duplicidade em %j', async (target, campo) => {
      prisma.$transaction.mockRejectedValue(erroPrisma('P2002', { target }));
      await expect(
        service.cadastrarProfissional(dto(), maximo),
      ).rejects.toThrow(`com este ${campo}`);
      expect(mail.enviarSenhaProvisoria).not.toHaveBeenCalled();
    });

    it.each(['P2025', 'P2003'])(
      'traduz o erro %s de relação inexistente',
      async (codigo) => {
        prisma.$transaction.mockRejectedValue(erroPrisma(codigo));
        await expect(
          service.cadastrarProfissional(dto(), maximo),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('não mascara erro inesperado', async () => {
      prisma.$transaction.mockRejectedValue(new Error('falha'));
      await expect(
        service.cadastrarProfissional(dto(), maximo),
      ).rejects.toThrow('falha');
    });
  });

  describe('reenviarSenha', () => {
    it.each([
      [
        'paciente',
        { id_tipo_usuario: T.PACIENTE, id_situacao_usuario: S.PENDENCIA_I },
      ],
      ['profissional já Deferido', {}],
    ])('recusa %s', async (_nome, extra) => {
      noBanco(extra);
      await expect(service.reenviarSenha(5, maximo)).rejects.toThrow(
        'Só dá para reenviar',
      );
    });

    it('recusa usuário inativo', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_I, ativo: false });
      await expect(service.reenviarSenha(5, maximo)).rejects.toThrow(
        'Reative o usuário',
      );
    });

    it('renova a senha, registra o log e envia o e-mail', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_I });
      await expect(service.reenviarSenha(5, maximo)).resolves.toEqual({
        email_enviado: true,
        senha_provisoria_expira_em: EXPIRA,
      });
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: 5 },
        data: { senha_hash: 'hash-novo', senha_provisoria_expira_em: EXPIRA },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: AcaoGestao.REENVIAR_SENHA }),
        prisma,
      );
      expect(mail.enviarSenhaProvisoria).toHaveBeenCalledWith(
        'ana@pasi.test',
        'Ana Lima',
        SENHA,
        EXPIRA,
      );
    });
  });

  describe('corrigirEmail', () => {
    it('só permite corrigir em Pendência I', async () => {
      await expect(
        service.corrigirEmail(5, 'novo@pasi.test', maximo),
      ).rejects.toThrow('enquanto o cadastro está em Pendência I');
    });

    it('recusa o mesmo e-mail do cadastro', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_I });
      await expect(
        service.corrigirEmail(5, ' ANA@pasi.test ', maximo),
      ).rejects.toThrow('é o mesmo do cadastro');
    });

    it('salva o e-mail e envia nova senha para o endereço corrigido', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_I });
      await service.corrigirEmail(5, ' Novo@pasi.test ', maximo);
      expect(prisma.usuario.update.mock.calls[0][0].data).toMatchObject({
        email: 'novo@pasi.test',
      });
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: AcaoGestao.CORRIGIR_EMAIL,
          detalhe: 'ana@pasi.test → novo@pasi.test',
        }),
        prisma,
      );
      expect(mail.enviarSenhaProvisoria).toHaveBeenCalledWith(
        'novo@pasi.test',
        'Ana Lima',
        SENHA,
        EXPIRA,
      );
    });

    it('traduz e-mail já usado por outro usuário', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_I });
      prisma.$transaction.mockRejectedValue(
        erroPrisma('P2002', { target: ['email'] }),
      );
      await expect(
        service.corrigirEmail(5, 'novo@pasi.test', maximo),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe.each([
    [
      'inativar',
      'inativar' as const,
      true,
      'já está inativo',
      false,
      AcaoGestao.INATIVAR,
    ],
    [
      'reativar',
      'reativar' as const,
      false,
      'já está ativo',
      true,
      AcaoGestao.REATIVAR,
    ],
  ])('%s', (_nome, metodo, ativoAtual, mensagem, ativoNovo, acao) => {
    it('protege outro usuário máximo', async () => {
      noBanco({ id_tipo_usuario: T.MAXIMO, ativo: ativoAtual });
      await expect(service[metodo](5, maximo)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('impede a ação sobre si mesmo', async () => {
      noBanco({ id_usuario: maximo.id_usuario, ativo: ativoAtual });
      await expect(service[metodo](maximo.id_usuario, maximo)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('recusa usuário que já está na situação desejada', async () => {
      noBanco({ ativo: ativoNovo });
      await expect(service[metodo](5, maximo)).rejects.toThrow(mensagem);
    });

    it('altera o acesso e registra o log', async () => {
      noBanco({ ativo: ativoAtual });
      await service[metodo](5, maximo);
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: 5 },
        data: { ativo: ativoNovo },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        { acao, idAutor: maximo.id_usuario, idAlvo: 5 },
        prisma,
      );
    });
  });

  describe('promover', () => {
    it.each([
      ['paciente', { id_tipo_usuario: T.PACIENTE }],
      ['usuário já máximo', { id_tipo_usuario: T.MAXIMO }],
      ['intermediário inativo', { ativo: false }],
    ])('recusa %s', async (_nome, extra) => {
      noBanco(extra);
      await expect(service.promover(5, maximo)).rejects.toThrow(
        'Só intermediários ativos',
      );
    });

    it('promove o intermediário e registra o log', async () => {
      await service.promover(5, maximo);
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: 5 },
        data: { tipo_usuario: { connect: { id_tipo_usuario: T.MAXIMO } } },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: AcaoGestao.PROMOVER }),
        prisma,
      );
    });
  });

  describe('unidades de um intermediário', () => {
    it('não gere unidades de usuário que não é intermediário', async () => {
      noBanco({ id_tipo_usuario: T.MAXIMO });
      await expect(service.trocarSede(5, 1, maximo)).rejects.toThrow(
        ForbiddenException,
      );
      expect(vinculos.trocarSede).not.toHaveBeenCalled();
    });

    it('vincula em nome do máximo logado', async () => {
      await service.vincularUnidade(5, 1, true, maximo);
      expect(vinculos.vincular).toHaveBeenCalledWith(
        5,
        1,
        true,
        maximo.id_usuario,
      );
    });

    it('desvincula em nome do máximo logado', async () => {
      await service.desvincularUnidade(5, 1, maximo);
      expect(vinculos.desvincular).toHaveBeenCalledWith(
        5,
        1,
        maximo.id_usuario,
      );
    });

    it('troca a sede em nome do máximo logado', async () => {
      await service.trocarSede(5, 1, maximo);
      expect(vinculos.trocarSede).toHaveBeenCalledWith(5, 1, maximo.id_usuario);
    });
  });
});
