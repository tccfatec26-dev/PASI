import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  LINK_REDEFINICAO_HORAS,
  SituacaoUsuario,
  TipoUsuario,
  ehProfissional,
} from '../common/constants';
import { conferirSenha, hashSenha } from '../acesso/senha';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PrimeiroAcessoDto, RedefinirSenhaDto } from './dto/nova-senha.dto';
import type { AuthUser } from './current-user.decorator';
import { JwtPayload } from './jwt.strategy';

const RESPOSTA_ESQUECEU =
  'Se o e-mail estiver cadastrado, você receberá as instruções em breve.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /**
   * Login por e-mail ou CPF. Regras:
   *  - usuário inativo não entra (RN-USR-06);
   *  - canal "web" só aceita profissionais; "app", só pacientes;
   *  - em Pendência I, a senha é a provisória e vale até senha_provisoria_expira_em
   *    (RN-USR-07). O token devolvido só serve para trocar a senha (guard).
   */
  async login(dto: LoginDto) {
    const identifier = dto.login.trim();
    const isEmail = identifier.includes('@');

    const usuario = await this.prisma.usuario.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { cpf: identifier.replace(/\D/g, '') },
      include: { situacao_usuario: true },
    });

    if (!usuario || !(await conferirSenha(dto.senha, usuario.senha_hash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedException('Seu acesso está inativo. Fale com a gestão da sua unidade.');
    }

    if (dto.canal === 'web' && !ehProfissional(usuario.id_tipo_usuario)) {
      throw new ForbiddenException('O painel web é só para profissionais. Pacientes usam o app do PASI.');
    }
    if (dto.canal === 'app' && usuario.id_tipo_usuario !== TipoUsuario.PACIENTE) {
      throw new ForbiddenException('Profissionais acessam o PASI pelo painel web.');
    }

    if (
      usuario.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I &&
      (!usuario.senha_provisoria_expira_em || usuario.senha_provisoria_expira_em.getTime() < Date.now())
    ) {
      throw new UnauthorizedException(
        'Sua senha provisória venceu. Peça à gestão da sua unidade que envie uma nova.',
      );
    }

    const payload: JwtPayload = {
      sub: usuario.id_usuario,
      tipo: usuario.id_tipo_usuario,
      email: usuario.email,
    };

    return {
      access_token: await this.jwt.signAsync(payload),
      usuario: this.semSegredos(usuario),
    };
  }

  /**
   * Pendência I (RN-USR-08): troca obrigatória da senha provisória. A nova
   * senha não pode ser igual à provisória. A situação passa a Pendência II
   * e o cliente deve encerrar a sessão e voltar ao login.
   */
  async primeiroAcesso(user: AuthUser, dto: PrimeiroAcessoDto) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id_usuario: user.id_usuario } });

    if (await conferirSenha(dto.nova_senha, usuario.senha_hash)) {
      throw new BadRequestException('A nova senha precisa ser diferente da senha provisória.');
    }

    await this.prisma.usuario.update({
      where: { id_usuario: user.id_usuario },
      data: {
        senha_hash: await hashSenha(dto.nova_senha),
        senha_provisoria_expira_em: null,
        situacao_usuario: { connect: { id_situacao_usuario: SituacaoUsuario.PENDENCIA_II } },
      },
    });

    return {
      message: 'Senha criada. Entre de novo usando a senha que você acabou de criar.',
    };
  }

  /** "Esqueci a senha": envia o link de redefinição (1 hora) por e-mail. */
  async esqueceuSenha(dto: ForgotPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    // Responde sempre igual — não revela se o e-mail existe nem se está inativo.
    if (!usuario || !usuario.ativo) {
      return { message: RESPOSTA_ESQUECEU };
    }

    const token = randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + LINK_REDEFINICAO_HORAS * 60 * 60 * 1000);

    await this.prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { senha_reset_token: token, senha_reset_expira_em: expira },
    });

    await this.mail.enviarLinkRedefinicao(usuario.email, usuario.nome, token);

    return { message: RESPOSTA_ESQUECEU };
  }

  /**
   * Define a nova senha pelo link do e-mail. Quem estava em Pendência I
   * (ainda com a senha provisória) passa a Pendência II, como no primeiro acesso.
   */
  async redefinirSenha(dto: RedefinirSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { senha_reset_token: dto.token },
    });

    if (
      !usuario ||
      !usuario.senha_reset_expira_em ||
      usuario.senha_reset_expira_em.getTime() < Date.now()
    ) {
      throw new BadRequestException('Este link é inválido ou já venceu. Peça um novo em "Esqueci a senha".');
    }
    if (!usuario.ativo) {
      throw new ForbiddenException('Seu acesso está inativo. Fale com a gestão da sua unidade.');
    }

    await this.prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        senha_hash: await hashSenha(dto.nova_senha),
        senha_reset_token: null,
        senha_reset_expira_em: null,
        ...(usuario.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I
          ? {
              senha_provisoria_expira_em: null,
              situacao_usuario: { connect: { id_situacao_usuario: SituacaoUsuario.PENDENCIA_II } },
            }
          : {}),
      },
    });

    return { message: 'Senha redefinida. Entre com a nova senha.' };
  }

  private semSegredos<T extends { senha_hash?: string | null; senha_reset_token?: string | null }>(u: T) {
    const { senha_hash, senha_reset_token, ...resto } = u;
    void senha_hash;
    void senha_reset_token;
    return resto;
  }
}
