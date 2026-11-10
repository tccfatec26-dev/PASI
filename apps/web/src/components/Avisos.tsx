import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { D, Ic, IcErro, IcFechar, IcSucesso } from './icons';

type Tipo = 'success' | 'error' | 'info';

interface Aviso {
  id: number;
  tipo: Tipo;
  titulo: string;
  texto?: string;
  saindo: boolean;
}

interface AvisosValor {
  /** Mostra um aviso no canto inferior direito (some sozinho). */
  avisar: (a: { tipo?: Tipo; titulo: string; texto?: string }) => void;
}

const Ctx = createContext<AvisosValor | null>(null);
const DURACAO = { success: 5000, info: 5000, error: 8000 };
const SAIDA = 320;

/**
 * Avisos de ações feitas ("toasts"): entram deslizando da direita, ficam no
 * canto inferior direito com fundo de vidro e somem sozinhos. Passar o mouse
 * ou focar pausa a contagem.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const proximo = useRef(1);

  const fechar = useCallback((id: number) => {
    setAvisos((l) => l.map((a) => (a.id === id ? { ...a, saindo: true } : a)));
    window.setTimeout(() => setAvisos((l) => l.filter((a) => a.id !== id)), SAIDA);
  }, []);

  const avisar = useCallback<AvisosValor['avisar']>(({ tipo = 'success', titulo, texto }) => {
    const id = proximo.current++;
    // no máximo 3 na tela: o mais antigo sai
    setAvisos((l) => [...l.filter((a) => !a.saindo).slice(-2), { id, tipo, titulo, texto, saindo: false }]);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="ps avisos" aria-live="polite" aria-relevant="additions">
        {avisos.map((a) => (
          <ItemAviso key={a.id} aviso={a} aoFechar={() => fechar(a.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ItemAviso({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const [pausado, setPausado] = useState(false);
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    if (pausado || aviso.saindo) return;
    const t = window.setTimeout(() => fecharRef.current(), DURACAO[aviso.tipo]);
    return () => window.clearTimeout(t);
  }, [pausado, aviso.saindo, aviso.tipo]);

  const icone =
    aviso.tipo === 'success' ? <IcSucesso lg /> : aviso.tipo === 'error' ? <IcErro lg /> : <Ic d={D.info} lg />;
  return (
    <div
      className={`aviso ${aviso.tipo}${aviso.saindo ? ' saindo' : ''}`}
      role={aviso.tipo === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <span className="aviso-ico">{icone}</span>
      <div className="aviso-corpo">
        <strong>{aviso.titulo}</strong>
        {aviso.texto && <span>{aviso.texto}</span>}
      </div>
      <button type="button" className="aviso-x" aria-label="Fechar aviso" onClick={aoFechar}>
        <IcFechar />
      </button>
    </div>
  );
}

export function useAvisos() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAvisos fora do AvisosProvider');
  return v.avisar;
}
