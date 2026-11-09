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
  paciente,
} from '../../test/helpers/dubles';
import { conferirSenha, hashSenha } from '../acesso/senha';
import { SituacaoUsuario as S, TipoUsuario as T } from '../common/constants';
import { UsuariosService } from './usuarios.service';

jest.mock('../acesso/senha');

describe('UsuariosService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let acesso: ReturnType<typeof criarDuble>;
  let vinculos: ReturnType<typeof criarDuble>;
  let service: UsuariosService;

  const usuarioBanco = (extra: Record<string, unknown> = {}) => ({
    id_usuario: paciente.id_usuario,
    id_tipo_usuario: T.PACIENTE,
    id_situacao_usuario: S.DEFERIDO,
    email: 'joao@pasi.test',
    senha_hash: 'hash',
    senha_reset_token: 'token',
    ...extra,
  });

  const noBanco = (extra?: Record<string, unknown>) => {
    const usuario = usuarioBanco(extra);
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.findUniqueOrThrow.mockResolvedValue(usuario);
  };

  beforeEach(() => {
    prisma = criarPrismaMock();
    acesso = criarDuble();
    vinculos = criarDuble();
    service = new UsuariosService(prisma, acesso, vinculos);
    jest.mocked(hashSenha).mockResolvedValue('hash-novo');
    jest.mocked(conferirSenha).mockResolvedValue(true);
    vinculos.listar.mockResolvedValue([]);
    noBanco();
  });

  describe('createPaciente', () => {
    const dto = {
      nome: 'João Silva',
      cpf: '98765432100',
      email: 'JOAO@Email.com',
      tel_celular: '11988887777',
      sexo: 'M',
      senha: 'Senha@123',
    };

    beforeEach(() => {
      prisma.usuario.create.mockResolvedValue(usuarioBanco());
    });

    it('nasce paciente, ativo e Deferido', async () => {
      await service.createPaciente(dto);
      expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({
        ativo: true,
        tipo_usuario: { connect: { id_tipo_usuario: T.PACIENTE } },
        situacao_usuario: { connect: { id_situacao_usuario: S.DEFERIDO } },
      });
    });

    it('guarda o e-mail em minúsculas e somente o hash da senha', async () => {
      await service.createPaciente(dto);
      const { data } = prisma.usuario.create.mock.calls[0][0];
      expect(data).toMatchObject({
        email: 'joao@email.com',
        senha_hash: 'hash-novo',
        nac_estrangeira: false,
      });
      expect(JSON.stringify(data)).not.toContain(dto.senha);
    });

    it('converte a data de nascimento e liga o gênero', async () => {
      await service.createPaciente({
        ...dto,
        dt_nascimento: '2015-04-23',
        id_genero: 2,
      });
      expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({
        dt_nascimento: new Date('2015-04-23'),
        genero: { connect: { id_genero: 2 } },
      });
    });

    it('não devolve dados sigilosos', async () => {
      const r = await service.createPaciente(dto);
      expect(r).not.toHaveProperty('senha_hash');
      expect(r).not.toHaveProperty('senha_reset_token');
    });

    it.each([
      [['cpf'], 'CPF'],
      [['email'], 'e-mail'],
      [['tel_celular'], 'celular'],
      ['indice_x', 'indice_x'],
    ])('traduz duplicidade em %j', async (target, campo) => {
      prisma.usuario.create.mockRejectedValue(erroPrisma('P2002', { target }));
      await expect(service.createPaciente(dto)).rejects.toThrow(
        `Já existe um usuário com este ${campo}.`,
      );
    });

    it('traduz gênero inexistente', async () => {
      prisma.usuario.create.mockRejectedValue(erroPrisma('P2025'));
      await expect(service.createPaciente(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('não mascara erro inesperado', async () => {
      prisma.usuario.create.mockRejectedValue(new Error('falha'));
      await expect(service.createPaciente(dto)).rejects.toThrow('falha');
    });
  });

  describe('listPacientes', () => {
    const where = () => prisma.usuario.findMany.mock.calls[0][0].where;

    it('bloqueia paciente', async () => {
      await expect(service.listPacientes(undefined, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lista só pacientes ativos, com no máximo 20 resultados', async () => {
      await service.listPacientes(undefined, intermediario);
      expect(prisma.usuario.findMany.mock.calls[0][0]).toMatchObject({
        where: { id_tipo_usuario: T.PACIENTE, ativo: true },
        take: 20,
      });
    });

    it('busca por nome sem acento e por CPF', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      await service.listPacientes('123', intermediario);
      expect(where().OR).toEqual([
        { id_usuario: { in: [1] } },
        { cpf: { contains: '123' } },
      ]);
    });

    it('não busca CPF vazio quando o termo não tem dígitos', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await service.listPacientes('Maria', intermediario);
      expect(where().OR).toEqual([{ id_usuario: { in: [] } }]);
    });

    it('usa a busca comum quando a extensão unaccent falha', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('sem unaccent'));
      await service.listPacientes('Maria', intermediario);
      expect(where().OR).toEqual([
        { nome: { contains: 'Maria', mode: 'insensitive' } },
      ]);
    });
  });

  describe('findById', () => {
    it('responde 404 quando não existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.findById(1)).rejects.toThrow(NotFoundException);
    });

    it('não devolve dados sigilosos e não busca unidades de paciente', async () => {
      const r = await service.findById(1);
      expect(r).not.toHaveProperty('senha_hash');
      expect(r.unidades).toEqual([]);
      expect(vinculos.listar).not.toHaveBeenCalled();
    });

    it('inclui as unidades do profissional', async () => {
      noBanco({ id_tipo_usuario: T.INTERMEDIARIO });
      vinculos.listar.mockResolvedValue([{ id_usuario_unidade: 3 }]);
      await expect(service.findById(1)).resolves.toMatchObject({
        unidades: [{ id_usuario_unidade: 3 }],
      });
    });
  });

  describe('updateMe', () => {
    const dados = () => prisma.usuario.update.mock.calls[0][0].data;

    it('responde 404 quando não existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.updateMe(paciente, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trava a troca de e-mail em Pendência II', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_II });
      await expect(
        service.updateMe(paciente, { email: 'novo@pasi.test' }),
      ).rejects.toThrow('não pode ser alterado');
    });

    it('aceita reenviar o mesmo e-mail em Pendência II', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_II });
      await expect(
        service.updateMe(paciente, { email: ' JOAO@pasi.test ' }),
      ).resolves.toBeDefined();
    });

    it('permite trocar o e-mail de quem está Deferido', async () => {
      await service.updateMe(paciente, { email: ' Novo@pasi.test ' });
      expect(dados().email).toBe('novo@pasi.test');
    });

    it('recusa profissão para paciente', async () => {
      await expect(
        service.updateMe(paciente, { id_profissao: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('liga profissão e gênero do profissional', async () => {
      noBanco({ id_tipo_usuario: T.INTERMEDIARIO });
      await service.updateMe(intermediario, { id_profissao: 1, id_genero: 2 });
      expect(dados()).toMatchObject({
        profissao: { connect: { id_profissao: 1 } },
        genero: { connect: { id_genero: 2 } },
      });
    });

    it.each([
      ['converte a data informada', '2015-04-23', new Date('2015-04-23')],
      ['limpa a data vazia', '', null],
      ['mantém a data não informada', undefined, undefined],
    ])('%s', async (_nome, dt_nascimento, esperado) => {
      await service.updateMe(paciente, { dt_nascimento });
      expect(dados().dt_nascimento).toEqual(esperado);
    });

    it('traduz e-mail já usado por outro usuário', async () => {
      prisma.usuario.update.mockRejectedValue(
        erroPrisma('P2002', { target: ['email'] }),
      );
      await expect(
        service.updateMe(paciente, { email: 'x@y.com' }),
      ).rejects.toThrow('com este e-mail');
    });
  });

  describe('confirmarDados', () => {
    it.each([
      ['Pendência I', S.PENDENCIA_I],
      ['Deferido', S.DEFERIDO],
    ])('recusa quem está em %s', async (_nome, situacao) => {
      noBanco({ id_situacao_usuario: situacao });
      await expect(service.confirmarDados(paciente)).rejects.toThrow(
        'Não há dados pendentes',
      );
    });

    it('passa de Pendência II para Deferido', async () => {
      noBanco({ id_situacao_usuario: S.PENDENCIA_II });
      await service.confirmarDados(paciente);
      expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({
        situacao_usuario: { connect: { id_situacao_usuario: S.DEFERIDO } },
      });
    });
  });

  describe('trocarSenha', () => {
    it('exige a senha atual correta', async () => {
      jest.mocked(conferirSenha).mockResolvedValue(false);
      await expect(
        service.trocarSenha(paciente, {
          senha_atual: 'errada',
          nova_senha: 'Nova@1234',
        }),
      ).rejects.toThrow('senha atual não confere');
    });

    it('recusa nova senha igual à atual', async () => {
      await expect(
        service.trocarSenha(paciente, {
          senha_atual: 'Igual@123',
          nova_senha: 'Igual@123',
        }),
      ).rejects.toThrow('diferente da senha atual');
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('grava o hash da nova senha', async () => {
      await service.trocarSenha(paciente, {
        senha_atual: 'Atual@123',
        nova_senha: 'Nova@1234',
      });
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: paciente.id_usuario },
        data: { senha_hash: 'hash-novo' },
      });
    });
  });

  describe('unidades do próprio máximo', () => {
    it.each<[string, (s: UsuariosService) => unknown]>([
      ['vincularPropria', (s) => s.vincularPropria(intermediario, 1, false)],
      ['desvincularPropria', (s) => s.desvincularPropria(intermediario, 1)],
      ['trocarSedePropria', (s) => s.trocarSedePropria(intermediario, 1)],
    ])('%s é exclusivo do perfil máximo', (_nome, executar) => {
      acesso.exigirMaximo.mockImplementation(() => {
        throw new ForbiddenException();
      });
      expect(() => executar(service)).toThrow(ForbiddenException);
      expect(vinculos.vincular).not.toHaveBeenCalled();
    });

    it('vincula a unidade a si mesmo', () => {
      void service.vincularPropria(maximo, 1, true);
      expect(vinculos.vincular).toHaveBeenCalledWith(
        maximo.id_usuario,
        1,
        true,
        maximo.id_usuario,
      );
    });

    it('desvincula a unidade de si mesmo', () => {
      void service.desvincularPropria(maximo, 1);
      expect(vinculos.desvincular).toHaveBeenCalledWith(
        maximo.id_usuario,
        1,
        maximo.id_usuario,
      );
    });

    it('troca a própria sede', () => {
      void service.trocarSedePropria(maximo, 1);
      expect(vinculos.trocarSede).toHaveBeenCalledWith(
        maximo.id_usuario,
        1,
        maximo.id_usuario,
      );
    });
  });
});
