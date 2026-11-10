/**
 * Seletor segmentado (.ps-seg). O destaque que desliza e o arraste vêm de
 * behaviors/seg.js; aqui fica só o estado (qual opção está escolhida).
 */
export function Seg<T extends string | number>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  papel = 'radiogroup',
  desabilitado = false,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo?: string;
  papel?: 'radiogroup' | 'group';
  desabilitado?: boolean;
}) {
  return (
    <div className="ps-seg" role={papel} aria-label={rotulo} aria-disabled={desabilitado || undefined}>
      {opcoes.map((o) => {
        const sel = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            className={sel ? 'is-selected' : ''}
            aria-pressed={sel}
            disabled={desabilitado}
            onClick={() => aoMudar(o.valor)}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
