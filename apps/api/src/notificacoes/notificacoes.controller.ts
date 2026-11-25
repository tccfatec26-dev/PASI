import { Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { NotificacoesService } from './notificacoes.service';
import { QueryNotificacaoDto } from './dto/query-notificacao.dto';

@ApiTags('notificacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

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

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marca uma notificação do usuário logado como lida' })
  marcarLida(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.notificacoes.marcarLida(id, user);
  }
}
