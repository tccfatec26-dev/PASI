import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { FormulariosModule } from './formularios/formularios.module';
import { RespostasModule } from './respostas/respostas.module';
import { AvaliacoesModule } from './avaliacoes/avaliacoes.module';
import { ApoioModule } from './apoio/apoio.module';
import { DocumentosModule } from './documentos/documentos.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AcessoModule } from './acesso/acesso.module';
import { GestaoModule } from './gestao/gestao.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    MailModule,
    AcessoModule,
    AuthModule,
    UsuariosModule,
    AtendimentosModule,
    FormulariosModule,
    RespostasModule,
    AvaliacoesModule,
    ApoioModule,
    DocumentosModule,
    HealthModule,
    GestaoModule,
  ],
})
export class AppModule {}
