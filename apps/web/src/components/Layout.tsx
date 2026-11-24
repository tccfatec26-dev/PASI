import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCabecalhoCompacto } from './useCabecalhoCompacto';
import { Sidebar } from './Sidebar';
import { NavMovel } from './NavMovel';
import { Ic, IcInfo, IcVoltar } from './icons';

const CHAVE_MENU = 'pasi.menuOculto';
/** Até esta largura (celular e tablet) o menu lateral vira uma gaveta. */
const GAVETA = '(max-width: 1100px)';
const ICONE_MENU = 'M4 7h16M4 12h16M4 17h16';

/** Abre a gaveta do menu (celular/tablet). O botão fica no cabeçalho de cada tela. */
const MenuContexto = createContext<{ gaveta: boolean; abrir: () => void }>({ gaveta: false, abrir: () => {} });

function useMidia(consulta: string) {
  const [bate, setBate] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudou = () => setBate(m.matches);
    mudou();
    m.addEventListener('change', mudou);
    return () => m.removeEventListener('change', mudou);
  }, [consulta]);
  return bate;
}

/** Esqueleto das telas logadas: menu lateral + conteúdo (classe .ps.app). */
export function AppLayout() {
  const { pathname } = useLocation();
  const gaveta = useMidia(GAVETA);
  const [aberta, setAberta] = useState(false);
  // cada tela começa do topo (com o cabeçalho expandido) e com a gaveta fechada
  useEffect(() => {
    window.scrollTo(0, 0);
    setAberta(false);
  }, [pathname]);
  // esconder o menu lateral para ganhar espaço (computador; lembrado neste navegador)
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MENU) === '1';
    } catch {
      return false;
    }
  });
  function alternarMenu() {
    const novo = !oculto;
    setOculto(novo);
    try {
      localStorage.setItem(CHAVE_MENU, novo ? '1' : '0');
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }

  // gaveta aberta: Esc fecha, a página atrás não rola e o foco vai para o menu
  const slot = useRef<HTMLDivElement>(null);
  const botaoQueAbriu = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!gaveta || !aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberta(false);
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    slot.current?.querySelector<HTMLElement>('.menu-fechar, a, button')?.focus();
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      botaoQueAbriu.current?.focus?.();
    };
  }, [gaveta, aberta]);
  useEffect(() => {
    if (!gaveta) setAberta(false);
  }, [gaveta]);

  const abrir = useCallback(() => {
    botaoQueAbriu.current = document.activeElement as HTMLElement | null;
    setAberta(true);
  }, []);
  const contexto = useMemo(() => ({ gaveta, abrir }), [gaveta, abrir]);

  const escondido = gaveta ? !aberta : oculto;
  const classes = 'ps app' + (gaveta ? ' em-gaveta' : oculto ? ' menu-oculto' : '') + (gaveta && aberta ? ' gaveta-aberta' : '');
  return (
    <MenuContexto.Provider value={contexto}>
      <div className={classes}>
        <div
          ref={slot}
          className="side-slot"
          inert={escondido || undefined}
          role={gaveta ? 'dialog' : undefined}
          aria-modal={gaveta && aberta ? true : undefined}
          aria-label={gaveta ? 'Menu' : undefined}
        >
          <Sidebar aoEsconder={gaveta ? () => setAberta(false) : alternarMenu} rotuloFechar={gaveta ? 'Fechar menu' : undefined} />
        </div>
        {gaveta && <div className="gaveta-fundo" aria-hidden="true" onClick={() => setAberta(false)} />}
        {!gaveta && oculto && (
          <button type="button" className="menu-alterna tt" onClick={alternarMenu} aria-label="Mostrar menu lateral" data-tip="Mostrar menu">
            <Ic d={ICONE_MENU} />
          </button>
        )}
        <main className="main" inert={(gaveta && aberta) || undefined}>
          <Outlet />
        </main>
        {/* celular (até 560px): barra superior e abas inferiores; fora dessa largura ficam ocultas */}
        <div className="nav-movel-slot" inert={(gaveta && aberta) || undefined}>
          <NavMovel aoAbrirMenu={abrir} />
        </div>
      </div>
    </MenuContexto.Provider>
  );
}

/** Botão ☰ do cabeçalho: só aparece quando o menu é gaveta (celular/tablet). */
function BotaoMenu() {
  const { gaveta, abrir } = useContext(MenuContexto);
  if (!gaveta) return null;
  return (
    <button type="button" className="menu-movel" onClick={abrir} aria-label="Abrir menu" aria-haspopup="dialog">
      <Ic d={ICONE_MENU} lg />
    </button>
  );
}

export interface Migalha {
  rotulo: string;
  para?: string;
}

/** Cabeçalho de página: migalhas, voltar, título, dica e ações. */
export function PageHead({
  migalhas = [],
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
  /** vazio na tela inicial: sem caminho (não há para onde voltar) */
  migalhas?: Migalha[];
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
      <BotaoMenu />
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
        {migalhas.length > 0 && (
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
        )}
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
