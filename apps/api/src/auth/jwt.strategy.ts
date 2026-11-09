import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './current-user.decorator';

export interface JwtPayload {
  sub: number; // id_usuario
  tipo: number; // id_tipo_usuario
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET não configurado');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * O retorno vira o request.user. Lê o usuário no banco a cada requisição
   * para que inativação, promoção e mudança de situação valham na hora,
   * sem esperar o token expirar (RN-USR-06).
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: payload.sub },
      select: { id_usuario: true, id_tipo_usuario: true, email: true, ativo: true, id_situacao_usuario: true },
    });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo ou inexistente.');
    }
    return {
      id_usuario: usuario.id_usuario,
      tipo: usuario.id_tipo_usuario,
      email: usuario.email,
      situacao: usuario.id_situacao_usuario,
    };
  }
}
