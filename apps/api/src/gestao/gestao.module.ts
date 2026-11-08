import { Module } from '@nestjs/common';
import { GestaoUsuariosController } from './gestao-usuarios.controller';
import { GestaoUsuariosService } from './gestao-usuarios.service';

@Module({
  controllers: [GestaoUsuariosController],
  providers: [GestaoUsuariosService],
})
export class GestaoModule {}
