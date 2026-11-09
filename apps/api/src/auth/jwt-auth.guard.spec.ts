import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SituacaoUsuario } from '../common/constants';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;
  let autenticacao: jest.SpyInstance;

  const contexto = (situacao: number) =>
    ({
      getHandler: () => 'rota',
      getClass: () => 'controller',
      switchToHttp: () => ({ getRequest: () => ({ user: { situacao } }) }),
    }) as unknown as ExecutionContext;

  const erroDe = async (situacao: number) =>
    guard
      .canActivate(contexto(situacao))
      .catch((e: ForbiddenException) => e.getResponse());

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    // A validação do token é do Passport; aqui testamos só a regra de situação.
    autenticacao = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => autenticacao.mockRestore());

  it('nega quando a autenticação falha', async () => {
    autenticacao.mockResolvedValue(false);
    await expect(
      guard.canActivate(contexto(SituacaoUsuario.DEFERIDO)),
    ).resolves.toBe(false);
  });

  it('libera usuário Deferido em rota sem configuração', async () => {
    await expect(
      guard.canActivate(contexto(SituacaoUsuario.DEFERIDO)),
    ).resolves.toBe(true);
  });

  it('bloqueia Pendência I com o código que orienta o cliente', async () => {
    await expect(erroDe(SituacaoUsuario.PENDENCIA_I)).resolves.toMatchObject({
      statusCode: 403,
      codigo: 'PENDENCIA_I',
    });
  });

  it('bloqueia Pendência II com o código que orienta o cliente', async () => {
    await expect(erroDe(SituacaoUsuario.PENDENCIA_II)).resolves.toMatchObject({
      statusCode: 403,
      codigo: 'PENDENCIA_II',
    });
  });

  it('bloqueia situação desconhecida', async () => {
    await expect(guard.canActivate(contexto(99))).rejects.toThrow(
      'Acesso negado.',
    );
  });

  it('libera a situação permitida pelo decorator da rota', async () => {
    reflector.getAllAndOverride.mockReturnValue([SituacaoUsuario.PENDENCIA_I]);
    await expect(
      guard.canActivate(contexto(SituacaoUsuario.PENDENCIA_I)),
    ).resolves.toBe(true);
  });

  it('bloqueia Deferido em rota exclusiva de Pendência I', async () => {
    reflector.getAllAndOverride.mockReturnValue([SituacaoUsuario.PENDENCIA_I]);
    await expect(
      guard.canActivate(contexto(SituacaoUsuario.DEFERIDO)),
    ).rejects.toThrow(ForbiddenException);
  });
});
