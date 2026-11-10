import { SituacaoAtendimento as SA, SituacaoFormulario as SF } from '../api/types';
import { D, Ic } from './icons';

const ATENDIMENTO: Record<number, { t: string; c: string; i: string }> = {
  [SA.CRIADO]: { t: 'Criado', c: 'ps-badge info', i: D.novoDoc },
  [SA.INICIADO]: { t: 'Iniciado', c: 'ps-badge progress', i: D.lapis },
  [SA.RESPONDIDO]: { t: 'Respondido', c: 'ps-badge warning', i: D.inbox },
  [SA.EM_AVALIACAO]: { t: 'Em avaliação', c: 'ps-badge evaluating', i: D.avaliar },
  [SA.AVALIADO]: { t: 'Avaliado', c: 'ps-badge success', i: D.checkCirculo },
  [SA.ENCERRADO]: { t: 'Encerrado', c: 'ps-badge closed', i: D.cadeado },
  [SA.INATIVO]: { t: 'Inativo', c: 'ps-badge neutral', i: D.proibido },
};

export const NOMES_SITUACAO_ATENDIMENTO = ATENDIMENTO;

export function infoSituacaoAtendimento(id: number) {
  return ATENDIMENTO[id] ?? { t: '—', c: 'ps-badge neutral', i: D.info };
}

/** Selo da situação do atendimento (com o mesmo ícone do protótipo). */
export function SeloAtendimento({ id, morph = false }: { id: number; morph?: boolean }) {
  const s = infoSituacaoAtendimento(id);
  if (morph)
    return (
      <span className={s.c + ' morph'} aria-live="polite">
        <span className="morph-c">
          <Ic d={s.i} />
          {s.t}
        </span>
      </span>
    );
  return (
    <span className={s.c}>
      <Ic d={s.i} />
      {s.t}
    </span>
  );
}

/** Situação do formulário do paciente NESTE atendimento (null = ainda não respondeu). */
export function infoSituacaoFormulario(id: number | null | undefined) {
  if (id === SF.AVALIADO) return { t: 'Avaliado', c: 'ps-badge success', i: D.checkCirculo };
  if (id === SF.EM_AVALIACAO) return { t: 'Em avaliação', c: 'ps-badge evaluating', i: D.avaliar };
  if (id === SF.RESPONDIDO) return { t: 'Respondido', c: 'ps-badge warning', i: D.inbox };
  if (id === SF.RASCUNHO) return { t: 'Em preenchimento', c: 'ps-badge progress', i: D.lapis };
  return { t: 'Pendente', c: 'ps-badge neutral', i: D.relogio };
}

export function SeloFormulario({ id }: { id: number | null | undefined }) {
  const s = infoSituacaoFormulario(id);
  return (
    <span className={s.c}>
      <Ic d={s.i} />
      {s.t}
    </span>
  );
}

/** Selo do tipo do formulário: CRAS azul, CAPS verde, CREAS amarelo. */
export function SeloTipo({ nome }: { nome?: string | null }) {
  if (!nome) return <span className="ps-badge neutral">—</span>;
  const n = nome.toUpperCase();
  const c = n.includes('CREAS') ? 'warning' : n.includes('CRAS') ? 'info' : n.includes('CAPS') ? 'success' : 'neutral';
  return <span className={'ps-badge ' + c}>{nome}</span>;
}
