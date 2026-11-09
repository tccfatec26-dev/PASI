import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SituacaoUsuario } from '../common/constants';
import { UsuariosService } from './usuarios.service';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { VincularUnidadeDto } from './dto/unidade-propria.dto';
import { TrocarSenhaDto } from '../auth/dto/nova-senha.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PermitirSituacoes } from '../auth/situacoes.decorator';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // O cadastro público de profissional deixou de existir (RN-USR-02):
  // profissionais são cadastrados pelo máximo em /gestao/usuarios/profissionais.

  @Post('paciente')
  @ApiOperation({ summary: 'Cadastra um usuário paciente (app); nasce ativo e Deferido' })
  createPaciente(@Body() dto: CreatePacienteDto) {
    return this.usuariosService.createPaciente(dto);
  }

  @Get('pacientes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista pacientes ativos para seleção pelo profissional (máx. 20)' })
  listPacientes(@Query('search') search: string | undefined, @CurrentUser() user: AuthUser) {
    return this.usuariosService.listPacientes(search, user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @PermitirSituacoes(SituacaoUsuario.PENDENCIA_I, SituacaoUsuario.PENDENCIA_II, SituacaoUsuario.DEFERIDO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastro completo do usuário autenticado (perfil, situação e unidades)' })
  me(@CurrentUser() user: AuthUser) {
    return this.usuariosService.findById(user.id_usuario);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @PermitirSituacoes(SituacaoUsuario.PENDENCIA_II, SituacaoUsuario.DEFERIDO)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza os dados pessoais do usuário autenticado (exceto CPF; e-mail travado em Pendência II)' })
  updateMe(@Body() dto: UpdateMeDto, @CurrentUser() user: AuthUser) {
    return this.usuariosService.updateMe(user, dto);
  }

  @Post('me/confirmar-dados')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @PermitirSituacoes(SituacaoUsuario.PENDENCIA_II)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pendência II: confirma os dados e passa a Deferido' })
  confirmarDados(@CurrentUser() user: AuthUser) {
    return this.usuariosService.confirmarDados(user);
  }

  @Patch('me/senha')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Troca a senha do usuário logado (exige a senha atual)' })
  trocarSenha(@Body() dto: TrocarSenhaDto, @CurrentUser() user: AuthUser) {
    return this.usuariosService.trocarSenha(user, dto);
  }

  @Post('me/unidades')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Máximo: vincula uma unidade a si mesmo' })
  vincularPropria(@Body() dto: VincularUnidadeDto, @CurrentUser() user: AuthUser) {
    return this.usuariosService.vincularPropria(user, dto.id_unidade_atendimento, dto.sede ?? false);
  }

  @Delete('me/unidades/:idUnidade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Máximo: desvincula uma unidade de si mesmo' })
  desvincularPropria(@Param('idUnidade', ParseIntPipe) idUnidade: number, @CurrentUser() user: AuthUser) {
    return this.usuariosService.desvincularPropria(user, idUnidade);
  }

  @Patch('me/unidades/:idUnidade/sede')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Máximo: marca uma das próprias unidades como sede' })
  trocarSedePropria(@Param('idUnidade', ParseIntPipe) idUnidade: number, @CurrentUser() user: AuthUser) {
    return this.usuariosService.trocarSedePropria(user, idUnidade);
  }
}
