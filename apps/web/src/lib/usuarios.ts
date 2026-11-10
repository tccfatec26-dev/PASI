import { SituacaoUsuario, TipoUsuario } from '../api/types';
import { dataHora } from './format';
import { D } from '../components/icons';

export const PERFIS: Record<number, { t: string; c: string; chave: 'maximo' | 'intermediario' | 'paciente' }> = {
  [TipoUsuario.MAXIMO]: { t: 'Máximo', c: 'ps-badge role-max', chave: 'maximo' },
  [TipoUsuario.INTERMEDIARIO]: { t: 'Intermediário', c: 'ps-badge role-mid', chave: 'intermediario' },
  [TipoUsuario.PACIENTE]: { t: 'Paciente', c: 'ps-badge role-min', chave: 'paciente' },
};

export const SITUACOES: Record<number, { t: string; c: string; i: string }> = {
  [SituacaoUsuario.PENDENCIA_I]: { t: 'Pendência I – Senha de acesso', c: 'ps-badge warning', i: D.cadeadoAberto },
  [SituacaoUsuario.PENDENCIA_II]: { t: 'Pendência II – Revisão de dados', c: 'ps-badge info', i: D.lapisLinha },
  [SituacaoUsuario.DEFERIDO]: { t: 'Deferido', c: 'ps-badge success', i: D.checkCirculo },
};

/** Observação da linha: prazo da senha provisória ou revisão pendente. */
export function observacao(situacao: number, expira?: string | null) {
  if (situacao === SituacaoUsuario.PENDENCIA_I) {
    if (!expira) return { texto: 'aguardando o primeiro acesso', alerta: false, icone: D.relogio };
    const vencida = new Date(expira).getTime() < Date.now();
    return vencida
      ? { texto: `venceu em ${dataHora(expira)}`, alerta: true, icone: D.alerta }
      : { texto: `senha vence em ${dataHora(expira)}`, alerta: false, icone: D.relogio };
  }
  if (situacao === SituacaoUsuario.PENDENCIA_II)
    return { texto: 'senha trocada; falta confirmar os dados', alerta: false, icone: D.lapisLinha };
  return null;
}
