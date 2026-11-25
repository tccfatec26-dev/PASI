import { Global, Module } from '@nestjs/common';
import { NotificacoesController } from './notificacoes.controller';
import { NotificacoesService } from './notificacoes.service';

/** Global: atendimentos e respostas gravam avisos pelo NotificacoesService. */
@Global()
@Module({
  controllers: [NotificacoesController],
  providers: [NotificacoesService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
