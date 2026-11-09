import { Type } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ApoioController } from '../apoio/apoio.controller';
import { AtendimentosController } from '../atendimentos/atendimentos.controller';
import { AuthController } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SITUACOES_PERMITIDAS } from '../auth/situacoes.decorator';
import { AvaliacoesController } from '../avaliacoes/avaliacoes.controller';
import { DocumentosController } from '../documentos/documentos.controller';
import { FormulariosController } from '../formularios/formularios.controller';
import { GestaoUsuariosController } from '../gestao/gestao-usuarios.controller';
import { HealthController } from '../health/health.controller';
import { RespostasController } from '../respostas/respostas.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';
import { SituacaoUsuario as S } from './constants';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), mkdirSync: jest.fn() }));

const metodosDe = (controller: Type<unknown>) =>
  Object.getOwnPropertyNames(controller.prototype).filter(
    (m) => m !== 'constructor',
  );

const handler = (controller: Type<unknown>, metodo: string) =>
  controller.prototype[metodo];

const exigeToken = (controller: Type<unknown>, metodo: string) =>
  [
    ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
    ...(Reflect.getMetadata(GUARDS_METADATA, handler(controller, metodo)) ??
      []),
  ].includes(JwtAuthGuard);

describe('Proteção das rotas', () => {
  it.each([
    AtendimentosController,
    RespostasController,
    AvaliacoesController,
    FormulariosController,
    GestaoUsuariosController,
    DocumentosController,
  ])('%p exige token em todas as rotas', (controller) => {
    expect(
      metodosDe(controller).filter((m) => !exigeToken(controller, m)),
    ).toEqual([]);
  });

  it('apenas as rotas de entrada de AuthController são públicas', () => {
    expect(
      metodosDe(AuthController)
        .filter((m) => !exigeToken(AuthController, m))
        .sort(),
    ).toEqual(['esqueceuSenha', 'login', 'redefinirSenha']);
  });

  it('apenas o cadastro de paciente é público em UsuariosController', () => {
    expect(
      metodosDe(UsuariosController).filter(
        (m) => !exigeToken(UsuariosController, m),
      ),
    ).toEqual(['createPaciente']);
  });

  it.each([ApoioController, HealthController])('%p é público', (controller) => {
    expect(
      metodosDe(controller).filter((m) => exigeToken(controller, m)),
    ).toEqual([]);
  });

  it.each<[string, Type<unknown>, string, number[]]>([
    [
      'troca da senha provisória',
      AuthController,
      'primeiroAcesso',
      [S.PENDENCIA_I],
    ],
    [
      'dados do token',
      AuthController,
      'me',
      [S.PENDENCIA_I, S.PENDENCIA_II, S.DEFERIDO],
    ],
    [
      'cadastro próprio',
      UsuariosController,
      'me',
      [S.PENDENCIA_I, S.PENDENCIA_II, S.DEFERIDO],
    ],
    [
      'edição do cadastro',
      UsuariosController,
      'updateMe',
      [S.PENDENCIA_II, S.DEFERIDO],
    ],
    [
      'confirmação dos dados',
      UsuariosController,
      'confirmarDados',
      [S.PENDENCIA_II],
    ],
  ])(
    '%s aceita somente as situações previstas',
    (_nome, controller, metodo, situacoes) => {
      expect(
        Reflect.getMetadata(SITUACOES_PERMITIDAS, handler(controller, metodo)),
      ).toEqual(situacoes);
    },
  );

  it('rotas de negócio não liberam usuários com pendência', () => {
    for (const controller of [
      AtendimentosController,
      RespostasController,
      AvaliacoesController,
      GestaoUsuariosController,
    ]) {
      for (const metodo of metodosDe(controller)) {
        expect(
          Reflect.getMetadata(
            SITUACOES_PERMITIDAS,
            handler(controller, metodo),
          ),
        ).toBeUndefined();
      }
    }
  });
});
