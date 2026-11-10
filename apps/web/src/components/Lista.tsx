import type { MouseEvent } from 'react';
import type { ReactNode } from 'react';
import { IcBusca, IcFiltro, Ic, D } from './icons';

/** Barra com busca e o botão de filtros (.toolbar). */
export function BarraBusca({
  busca,
  aoBuscar,
  placeholder,
  rotuloBusca = 'Buscar',
  filtrosAbertos,
  aoAlternarFiltros,
  nFiltros = 0,
  inline = false,
}: {
  busca: string;
  aoBuscar: (v: string) => void;
  placeholder: string;
  rotuloBusca?: string;
  filtrosAbertos?: boolean;
  aoAlternarFiltros?: () => void;
  nFiltros?: number;
  inline?: boolean;
}) {
  return (
    <div className={'toolbar' + (inline ? ' tb-inline' : '')}>
      <label className="ps-search">
        <IcBusca style={{ color: 'var(--Text-muted)' }} />
        <span className="ps-sr">{rotuloBusca}</span>
        <input type="search" placeholder={placeholder} value={busca} onChange={(e) => aoBuscar(e.target.value)} />
      </label>
      {aoAlternarFiltros && (
        <button
          type="button"
          className={'ps-btn secondary btn-filtro' + (filtrosAbertos ? ' is-active' : '')}
          aria-label="Filtros"
          data-tip="Filtros"
          aria-expanded={!!filtrosAbertos}
          onClick={aoAlternarFiltros}
        >
          <IcFiltro />
          {nFiltros > 0 && <span className="ps-count">{nFiltros}</span>}
        </button>
      )}
    </div>
  );
}

/** Painel de filtros que se expande (.fp-wrap > .fp-inner > .filter-panel). */
export function PainelFiltros({
  aberto,
  children,
  aoLimpar,
  aoAplicar,
}: {
  aberto: boolean;
  children: ReactNode;
  aoLimpar: () => void;
  aoAplicar: () => void;
}) {
  return (
    <div className={'fp-wrap' + (aberto ? ' is-open' : '')}>
      <div className="fp-inner">
        <div className="filter-panel" role="region" aria-label="Filtros" inert={!aberto ? true : undefined}>
          {children}
          <div className="apply">
            <button type="button" className="ps-btn tertiary" onClick={aoLimpar}>
              Limpar
            </button>
            <button type="button" className="ps-btn primary" onClick={aoAplicar}>
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function paginas(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, atual - 1, atual, atual + 1].filter((p) => p >= 1 && p <= total));
  if (atual <= 3) [2, 3].forEach((p) => set.add(p));
  if (atual >= total - 2) [total - 1, total - 2].forEach((p) => set.add(p));
  const ord = [...set].sort((a, b) => a - b);
  const r: (number | '…')[] = [];
  ord.forEach((p, i) => {
    if (i > 0 && p - ord[i - 1] > 1) r.push('…');
    r.push(p);
  });
  return r;
}

/** Rodapé com "Mostrando x–y de z" e a paginação (.ps-pagination). */
export function Paginacao({
  pagina,
  totalPaginas,
  total,
  porPagina,
  aoMudar,
  mostrarPorPagina = true,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  aoMudar: (p: number) => void;
  mostrarPorPagina?: boolean;
}) {
  const de = total ? (pagina - 1) * porPagina + 1 : 0;
  const ate = Math.min(pagina * porPagina, total);
  const ir = (p: number) => (e: MouseEvent) => {
    e.preventDefault();
    aoMudar(p);
  };
  const ultima = Math.max(1, totalPaginas);
  return (
    <footer>
      <span className="ps-results-meta">
        Mostrando <strong>{total ? `${de}–${ate}` : '0'}</strong> de <strong>{total}</strong>
        {mostrarPorPagina ? ` · ${porPagina} por página` : ''}
      </span>
      <nav className="ps-pagination" aria-label="Paginação">
        {pagina <= 1 ? (
          <span className="ps-page nav is-disabled">
            <Ic d={D.chevronEsq} />
            Anterior
          </span>
        ) : (
          <a className="ps-page nav" href="#" onClick={ir(pagina - 1)}>
            <Ic d={D.chevronEsq} />
            Anterior
          </a>
        )}
        {paginas(pagina, ultima).map((p, i) =>
          p === '…' ? (
            <span key={'g' + i} className="ps-page gap">
              …
            </span>
          ) : p === pagina ? (
            <span key={p} className="ps-page is-current" aria-current="page">
              {p}
            </span>
          ) : (
            <a key={p} className="ps-page" href="#" onClick={ir(p)}>
              {p}
            </a>
          ),
        )}
        {pagina >= ultima ? (
          <span className="ps-page nav is-disabled">
            Próxima
            <Ic d={D.chevronDir} />
          </span>
        ) : (
          <a className="ps-page nav" href="#" onClick={ir(pagina + 1)}>
            Próxima
            <Ic d={D.chevronDir} />
          </a>
        )}
      </nav>
    </footer>
  );
}

/** Linha única da tabela para carregando, erro ou lista vazia. */
export function LinhaEstado({ colunas, children }: { colunas: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colunas} className="vazio">
        {children}
      </td>
    </tr>
  );
}
