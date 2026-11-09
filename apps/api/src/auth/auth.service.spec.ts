import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  criarDuble,
  criarPrismaMock,
  paciente,
} from '../../test/helpers/dubles';
import { conferirSenha, hashSenha } from '../acesso/senha';
import { SituacaoUsuario, TipoUsuario } from '../common/constants';
import { AuthService } from './auth.service';

jest.mock('../acesso/senha');

const HORA = 60 * 60 * 1000;
const RESPOSTA_ESQUECEU =
  'Se o e-mail estiver cadastrado, você receberá as instruções em breve.';

describe('AuthService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let jwt: ReturnType<typeof criarDuble>;
  let mail: ReturnType<typeof criarDuble>;
  let service: AuthService;

  const usuarioBanco = (extra: Record<string, unknown> = {}) => ({
    id_usuario: 1,
    id_tipo_usuario: TipoUsuario.PACIENTE,
    id_situacao_usuario: SituacaoUsuario.DEFERIDO,
    email: 'maria@email.com',
    nome: 'Maria Souza',
    ativo: true,
    senha_hash: 'hash-guardado',
    senha_reset_token: 'token-guardado',
    senha_provisoria_expira_em: null,
    senha_reset_expira_em: new Date(Date.now() + HORA),
    ...extra,
  });

  beforeEach(() => {
    prisma = criarPrismaMock();
    jwt = criarDuble();
    mail = criarDuble();
    service = new AuthService(prisma, jwt, mail);
    jest.mocked(conferirSenha).mockResolvedValue(true);
    jest.mocked(hashSenha).mockResolvedValue('novo-hash');
    jwt.signAsync.mockResolvedValue('token-jwt');
  });

  describe('login', () => {
    const entrar = (extra = {}, dto = {}) => {
      prisma.usuario.findFirst.mockResolvedValue(usuarioBanco(extra));
      return service.login({
        login: 'maria@email.com',
        senha: 'Senha@123',
        ...dto,
      });
    };

    it('busca por e-mail em minúsculas e sem espaços', async () => {
      await entrar({}, { login: '  MARIA@Email.com ' });
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'maria@email.com' } }),
      );
    });

    it('busca por CPF considerando só os dígitos', async () => {
      await entrar({}, { login: '123.456.789-00' });
      expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cpf: '12345678900' } }),
      );
    });

    it('recusa usuário inexistente', async () => {
      prisma.usuario.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ login: 'x@x.com', senha: 'a' }),
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('recusa senha incorreta com a mesma mensagem de usuário inexistente', async () => {
      jest.mocked(conferirSenha).mockResolvedValue(false);
      await expect(entrar()).rejects.toThrow('Credenciais inválidas');
    });

    it('recusa usuário inativo', async () => {
      await expect(entrar({ ativo: false })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('impede paciente de entrar no painel web', async () => {
      await expect(entrar({}, { canal: 'web' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it.each([
      ['intermediário', TipoUsuario.INTERMEDIARIO],
      ['máximo', TipoUsuario.MAXIMO],
    ])('impede profissional %s de entrar pelo app', async (_nome, tipo) => {
      await expect(
        entrar({ id_tipo_usuario: tipo }, { canal: 'app' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite profissional no painel web', async () => {
      await expect(
        entrar(
          { id_tipo_usuario: TipoUsuario.INTERMEDIARIO },
          { canal: 'web' },
        ),
      ).resolves.toBeDefined();
    });

    it('permite paciente no app', async () => {
      await expect(entrar({}, { canal: 'app' })).resolves.toBeDefined();
    });

    it.each([
      ['vencida', new Date(Date.now() - 1000)],
      ['sem validade registrada', null],
    ])('recusa senha provisória %s em Pendência I', async (_nome, expira) => {
      await expect(
        entrar({
          id_situacao_usuario: SituacaoUsuario.PENDENCIA_I,
          senha_provisoria_expira_em: expira,
        }),
      ).rejects.toThrow('senha provisória venceu');
    });

    it('aceita senha provisória dentro da validade', async () => {
      await expect(
        entrar({
          id_situacao_usuario: SituacaoUsuario.PENDENCIA_I,
          senha_provisoria_expira_em: new Date(Date.now() + HORA),
        }),
      ).resolves.toHaveProperty('access_token', 'token-jwt');
    });

    it('assina o token com id, tipo e e-mail', async () => {
      await entrar();
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 1,
        tipo: TipoUsuario.PACIENTE,
        email: 'maria@email.com',
      });
    });

    it('nunca devolve o hash da senha nem o token de redefinição', async () => {
      const { usuario } = await entrar();
      expect(usuario).not.toHaveProperty('senha_hash');
      expect(usuario).not.toHaveProperty('senha_reset_token');
      expect(usuario).toHaveProperty('email', 'maria@email.com');
    });
  });

  describe('primeiroAcesso', () => {
    beforeEach(() => {
      prisma.usuario.findUniqueOrThrow.mockResolvedValue(usuarioBanco());
    });

    it('recusa nova senha igual à provisória', async () => {
      await expect(
        service.primeiroAcesso(paciente, { nova_senha: 'Igual@123' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('grava o novo hash e passa para Pendência II', async () => {
      jest.mocked(conferirSenha).mockResolvedValue(false);
      await service.primeiroAcesso(paciente, { nova_senha: 'Nova@1234' });
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: paciente.id_usuario },
        data: {
          senha_hash: 'novo-hash',
          senha_provisoria_expira_em: null,
          situacao_usuario: {
            connect: { id_situacao_usuario: SituacaoUsuario.PENDENCIA_II },
          },
        },
      });
    });
  });

  describe('esqueceuSenha', () => {
    it('não revela e-mail não cadastrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(
        service.esqueceuSenha({ email: 'nao@existe.com' }),
      ).resolves.toEqual({
        message: RESPOSTA_ESQUECEU,
      });
      expect(mail.enviarLinkRedefinicao).not.toHaveBeenCalled();
    });

    it('não envia link a usuário inativo e responde igual', async () => {
      prisma.usuario.findUnique.mockResolvedValue(
        usuarioBanco({ ativo: false }),
      );
      await expect(
        service.esqueceuSenha({ email: 'maria@email.com' }),
      ).resolves.toEqual({
        message: RESPOSTA_ESQUECEU,
      });
      expect(mail.enviarLinkRedefinicao).not.toHaveBeenCalled();
    });

    it('gera token aleatório válido por 1 hora e envia o e-mail', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBanco());
      const antes = Date.now();

      await expect(
        service.esqueceuSenha({ email: ' MARIA@email.com ' }),
      ).resolves.toEqual({
        message: RESPOSTA_ESQUECEU,
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'maria@email.com' },
      });
      const { data } = prisma.usuario.update.mock.calls[0][0];
      expect(data.senha_reset_token).toMatch(/^[0-9a-f]{64}$/);
      expect(data.senha_reset_expira_em.getTime()).toBeGreaterThanOrEqual(
        antes + HORA,
      );
      expect(mail.enviarLinkRedefinicao).toHaveBeenCalledWith(
        'maria@email.com',
        'Maria Souza',
        data.senha_reset_token,
      );
    });
  });

  describe('redefinirSenha', () => {
    const dto = { token: 'abc', nova_senha: 'Nova@1234' };

    it('recusa token desconhecido', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.redefinirSenha(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ['vencido', new Date(Date.now() - 1000)],
      ['sem validade', null],
    ])('recusa token %s', async (_nome, expira) => {
      prisma.usuario.findUnique.mockResolvedValue(
        usuarioBanco({ senha_reset_expira_em: expira }),
      );
      await expect(service.redefinirSenha(dto)).rejects.toThrow(
        'inválido ou já venceu',
      );
    });

    it('recusa usuário inativo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(
        usuarioBanco({ ativo: false }),
      );
      await expect(service.redefinirSenha(dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('troca a senha e invalida o token, sem mudar a situação de quem está Deferido', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioBanco());
      await service.redefinirSenha(dto);
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id_usuario: 1 },
        data: {
          senha_hash: 'novo-hash',
          senha_reset_token: null,
          senha_reset_expira_em: null,
        },
      });
    });

    it('leva quem estava em Pendência I para Pendência II', async () => {
      prisma.usuario.findUnique.mockResolvedValue(
        usuarioBanco({ id_situacao_usuario: SituacaoUsuario.PENDENCIA_I }),
      );
      await service.redefinirSenha(dto);
      expect(prisma.usuario.update.mock.calls[0][0].data).toMatchObject({
        senha_provisoria_expira_em: null,
        situacao_usuario: {
          connect: { id_situacao_usuario: SituacaoUsuario.PENDENCIA_II },
        },
      });
    });
  });
});
