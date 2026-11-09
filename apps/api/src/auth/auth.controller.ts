import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SituacaoUsuario } from '../common/constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PrimeiroAcessoDto, RedefinirSenhaDto } from './dto/nova-senha.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthUser } from './current-user.decorator';
import { PermitirSituacoes } from './situacoes.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica por e-mail OU CPF + senha e retorna um JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('primeiro-acesso')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @PermitirSituacoes(SituacaoUsuario.PENDENCIA_I)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pendência I: troca a senha provisória pela senha definitiva' })
  primeiroAcesso(@CurrentUser() user: AuthUser, @Body() dto: PrimeiroAcessoDto) {
    return this.authService.primeiroAcesso(user, dto);
  }

  @Post('esqueceu-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envia por e-mail o link de redefinição de senha (válido por 1 hora)' })
  esqueceuSenha(@Body() dto: ForgotPasswordDto) {
    return this.authService.esqueceuSenha(dto);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define a nova senha a partir do token recebido por e-mail' })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @PermitirSituacoes(SituacaoUsuario.PENDENCIA_I, SituacaoUsuario.PENDENCIA_II, SituacaoUsuario.DEFERIDO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna os dados do token do usuário autenticado (com a situação atual)' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
