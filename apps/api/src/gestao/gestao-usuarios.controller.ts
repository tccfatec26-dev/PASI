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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { VincularUnidadeDto } from '../usuarios/dto/unidade-propria.dto';
import { GestaoUsuariosService } from './gestao-usuarios.service';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { CorrigirEmailDto, CreateProfissionalDto } from './dto/create-profissional.dto';

/** Gestão de usuários — só o perfil máximo (checado no service). */
@ApiTags('gestao-usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gestao/usuarios')
export class GestaoUsuariosController {
  constructor(private readonly service: GestaoUsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários com filtros (perfil, situação, acesso, profissão) e contagem por situação' })
  listar(@Query() query: QueryUsuariosDto, @CurrentUser() user: AuthUser) {
    return this.service.listar(query, user);
  }

  @Post('profissionais')
  @ApiOperation({ summary: 'Cadastra profissional (intermediário ou máximo) e envia a senha provisória por e-mail' })
  cadastrar(@Body() dto: CreateProfissionalDto, @CurrentUser() user: AuthUser) {
    return this.service.cadastrarProfissional(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do usuário: dados, unidades, histórico e permissões' })
  detalhar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.detalhar(id, user);
  }

  @Post(':id/reenviar-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera e envia nova senha provisória (Pendência I), válida por 24 horas' })
  reenviarSenha(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.reenviarSenha(id, user);
  }

  @Patch(':id/email')
  @ApiOperation({ summary: 'Corrige o e-mail de um cadastro em Pendência I e envia nova senha provisória' })
  corrigirEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorrigirEmailDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.corrigirEmail(id, dto.email, user);
  }

  @Post(':id/inativar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inativa intermediário ou paciente' })
  inativar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.inativar(id, user);
  }

  @Post(':id/reativar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativa intermediário ou paciente' })
  reativar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.reativar(id, user);
  }

  @Post(':id/promover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promove intermediário ativo a máximo (mantém unidades e sede)' })
  promover(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.promover(id, user);
  }

  @Post(':id/unidades')
  @ApiOperation({ summary: 'Vincula unidade a um intermediário' })
  vincularUnidade(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VincularUnidadeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.vincularUnidade(id, dto.id_unidade_atendimento, dto.sede ?? false, user);
  }

  @Delete(':id/unidades/:idUnidade')
  @ApiOperation({ summary: 'Desvincula unidade de um intermediário (fica pelo menos uma; sede não sai)' })
  desvincularUnidade(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUnidade', ParseIntPipe) idUnidade: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.desvincularUnidade(id, idUnidade, user);
  }

  @Patch(':id/unidades/:idUnidade/sede')
  @ApiOperation({ summary: 'Marca outra unidade vinculada como sede do intermediário' })
  trocarSede(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUnidade', ParseIntPipe) idUnidade: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.trocarSede(id, idUnidade, user);
  }
}
