import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCabecalhoCompacto } from './useCabecalhoCompacto';
import { Sidebar } from './Sidebar';
import { IcInfo, IcVoltar } from './icons';

/** Esqueleto das telas logadas: menu lateral + conteúdo (classe .ps.app). */
export function AppLayout() {
  const { pathname } = useLocation();
  // cada tela começa do topo (com o cabeçalho expandido)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="ps app">
      <div className="side-slot">
        <Sidebar />
      </div>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export interface Migalha {
  rotulo: string;
  para?: string;
}

/** Cabeçalho de página: migalhas, voltar, título, dica e ações. */
export function PageHead({
  migalhas,
  voltar,
  titulo,
  dica,
  extra,
  acoes,
  acoesAlinhadas = false,
  linhaTitulo = 'title-row',
  antesDoTitulo,
  estiloBloco,
  gapTitulo,
}: {
  migalhas: Migalha[];
  voltar?: string;
  titulo: ReactNode;
  dica?: string;
  /** Elementos depois do título (selos etc.) */
  extra?: ReactNode;
  acoes?: ReactNode;
  acoesAlinhadas?: boolean;
  /** 'title-row' (padrão) ou 'flex' (linha com selos, como nos detalhes) */
  linhaTitulo?: 'title-row' | 'flex';
  antesDoTitulo?: ReactNode;
  estiloBloco?: CSSProperties;
  gapTitulo?: number;
}) {
  const cabecalho = useRef<HTMLElement>(null);
  useCabecalhoCompacto(cabecalho);
  const conteudo = (
    <>
      {voltar && (
        <Link className="back-btn" to={voltar} aria-label="Voltar" data-tip="Voltar">
          <IcVoltar />
        </Link>
      )}
      {antesDoTitulo}
      {typeof titulo === 'string' ? <h1>{titulo}</h1> : titulo}
      {extra}
      {dica && <InfoTip texto={dica} />}
    </>
  );
  return (
    <header className="page-head" ref={cabecalho}>
      <div className="ph-bloco" style={estiloBloco}>
        <nav className="ps-breadcrumb crumbs" aria-label="Caminho">
          {migalhas.map((m, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span className="sep" aria-hidden="true">
                  ›
                </span>
              )}
              {m.para ? <Link to={m.para}>{m.rotulo}</Link> : <span aria-current="page">{m.rotulo}</span>}
            </Fragment>
          ))}
        </nav>
        {linhaTitulo === 'title-row' ? (
          <div className="title-row ph-title" style={gapTitulo ? { gap: gapTitulo } : undefined}>
            {conteudo}
          </div>
        ) : (
          <div className="ph-title" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            {conteudo}
          </div>
        )}
      </div>
      {acoes && (
        <div className="actions" style={acoesAlinhadas ? { alignItems: 'center' } : undefined}>
          {acoes}
        </div>
      )}
    </header>
  );
}

export function InfoTip({ texto }: { texto: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={texto} data-tip={texto}>
      <IcInfo />
    </span>
  );
}

/** Título de painel com dica opcional (header > .hd-title). */
export function PanelTitle({ children, dica, id }: { children: ReactNode; dica?: string; id?: string }) {
  if (!dica) return <h2 id={id}>{children}</h2>;
  return (
    <div className="hd-title">
      <h2 id={id}>{children}</h2>
      <InfoTip texto={dica} />
    </div>
  );
}
