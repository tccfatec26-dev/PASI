import { SetMetadata } from '@nestjs/common';

export const SITUACOES_PERMITIDAS = 'situacoesPermitidas';

/**
 * Libera a rota para usuários em outras situações além de "Deferido"
 * (RN-USR-08 e RN-USR-09). Sem este decorator, o JwtAuthGuard só deixa
 * passar quem está Deferido.
 */
export const PermitirSituacoes = (...situacoes: number[]) =>
  SetMetadata(SITUACOES_PERMITIDAS, situacoes);
