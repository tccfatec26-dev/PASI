import { Global, Module } from '@nestjs/common';
import { AcessoService } from './acesso.service';
import { LogGestaoService } from './log-gestao.service';
import { VinculoUnidadeService } from './vinculo-unidade.service';

@Global()
@Module({
  providers: [AcessoService, LogGestaoService, VinculoUnidadeService],
  exports: [AcessoService, LogGestaoService, VinculoUnidadeService],
})
export class AcessoModule {}
