import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { SituacaoUsuario } from '../common/constants';
import type { AuthUser } from './current-user.decorator';
import { SITUACOES_PERMITIDAS } from './situacoes.decorator';

/**
 * Protege rotas exigindo um Bearer token JWT válido e, além disso, que o
 * usuário esteja na situação permitida pela rota (padrão: só "Deferido").
 * Pendência I só troca a senha provisória; Pendência II só edita e confirma
 * os próprios dados (a API recusa todo o resto).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const permitidas = this.reflector.getAllAndOverride<number[] | undefined>(SITUACOES_PERMITIDAS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [SituacaoUsuario.DEFERIDO];

    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!permitidas.includes(user.situacao)) {
      if (user.situacao === SituacaoUsuario.PENDENCIA_I) {
        throw new ForbiddenException({
          statusCode: 403,
          codigo: 'PENDENCIA_I',
          message: 'Crie a sua senha antes de usar o painel.',
        });
      }
      if (user.situacao === SituacaoUsuario.PENDENCIA_II) {
        throw new ForbiddenException({
          statusCode: 403,
          codigo: 'PENDENCIA_II',
          message: 'Revise e confirme os seus dados no Meu perfil para liberar o painel.',
        });
      }
      throw new ForbiddenException('Acesso negado.');
    }
    return true;
  }
}
