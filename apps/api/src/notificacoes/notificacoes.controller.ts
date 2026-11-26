import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { NotificacoesService } from './notificacoes.service';
import { QueryNotificacaoDto } from './dto/query-notificacao.dto';
import { RegistrarDispositivoDto, RemoverDispositivoDto } from './dto/dispositivo-push.dto';
import { PushService } from './push.service';

@ApiTags('notificacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor(
    private readonly notificacoes: NotificacoesService,
    private readonly push: PushService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Notificações do usuário logado (mais recentes primeiro), com o total de não lidas',
  })
  listar(@Query() query: QueryNotificacaoDto, @CurrentUser() user: AuthUser) {
    return this.notificacoes.listar(query, user);
  }

  @Patch('lidas')
  @ApiOperation({ summary: 'Marca todas as notificações do usuário logado como lidas' })
  marcarTodas(@CurrentUser() user: AuthUser) {
    return this.notificacoes.marcarTodasLidas(user);
  }

  @Put('dispositivos')
  @ApiOperation({
    summary: 'Registra o aparelho (token de push do Expo) do usuário logado para receber notificações push',
  })
  registrarDispositivo(@Body() dto: RegistrarDispositivoDto, @CurrentUser() user: AuthUser) {
    return this.push.registrar(dto.token, dto.plataforma, user);
  }

  @Delete('dispositivos')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove o aparelho do usuário logado (ao sair da conta no app)' })
  removerDispositivo(@Body() dto: RemoverDispositivoDto, @CurrentUser() user: AuthUser) {
    return this.push.remover(dto.token, user);
  }

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marca uma notificação do usuário logado como lida' })
  marcarLida(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.notificacoes.marcarLida(id, user);
  }
}
