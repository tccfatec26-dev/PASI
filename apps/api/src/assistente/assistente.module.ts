import { Module } from '@nestjs/common';
import { AssistenteController } from './assistente.controller';
import { AssistenteService } from './assistente.service';

/** Assistente virtual do app: pedido de atendente (MailService e NotificacoesService são globais). */
@Module({
  controllers: [AssistenteController],
  providers: [AssistenteService],
})
export class AssistenteModule {}
