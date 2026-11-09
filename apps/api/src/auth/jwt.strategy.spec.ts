import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { criarPrismaMock } from '../../test/helpers/dubles';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = (segredo?: string) =>
    ({ get: () => segredo }) as unknown as ConfigService;
  const payload = { sub: 1, tipo: 2, email: 'token@pasi.test' };
  let prisma: ReturnType<typeof criarPrismaMock>;
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = criarPrismaMock();
    strategy = new JwtStrategy(config('segredo-de-teste'), prisma);
  });

  it('não inicia sem JWT_SECRET configurado', () => {
    expect(() => new JwtStrategy(config(undefined), prisma)).toThrow(
      UnauthorizedException,
    );
  });

  it('usa os dados atuais do banco, não os do token', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      id_tipo_usuario: 3,
      email: 'banco@pasi.test',
      ativo: true,
      id_situacao_usuario: 3,
    });
    await expect(strategy.validate(payload)).resolves.toEqual({
      id_usuario: 1,
      tipo: 3,
      email: 'banco@pasi.test',
      situacao: 3,
    });
  });

  it('recusa usuário inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('recusa na hora um usuário inativado depois de emitir o token', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      ativo: false,
    });
    await expect(strategy.validate(payload)).rejects.toThrow(
      'Usuário inativo ou inexistente.',
    );
  });
});
