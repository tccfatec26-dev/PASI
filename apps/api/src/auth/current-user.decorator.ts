import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id_usuario: number;
  /** tipo_usuario: 1 intermediário, 2 paciente, 3 máximo */
  tipo: number;
  email: string;
  /** situacao_usuario atual (lida do banco a cada requisição) */
  situacao: number;
}

/** Injeta o usuário autenticado (vindo do JwtStrategy.validate) no handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
