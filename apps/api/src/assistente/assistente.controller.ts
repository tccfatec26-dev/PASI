import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { AssistenteService } from './assistente.service';
import { PedidoAtendenteDto } from './dto/pedido-atendente.dto';

@ApiTags('assistente')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assistente')
export class AssistenteController {
  constructor(private readonly assistente: AssistenteService) {}

  @Post('atendente')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Paciente pede para falar com um atendente: e-mail para a unidade do atendimento e aviso ao profissional que o criou',
  })
  pedirAtendente(@Body() dto: PedidoAtendenteDto, @CurrentUser() user: AuthUser) {
    return this.assistente.pedirAtendente(dto, user);
  }
}
