import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { IcAlerta, IcCheck, IcFechar, IcInativar } from './icons';

type Icone = 'ok' | 'warning' | 'error' | ReactNode;

/**
 * Janela no padrão do protótipo (.ps-scrim > .ps-modal). A entrada e a saída
 * animadas vêm do CSS e de behaviors/modal.js. Renderize só quando aberta.
 */
export function Modal({
  titulo,
  subtitulo,
  icone,
  children,
  rodape,
  aoFechar,
  alerta = false,
  fecharNoX = false,
  largura,
  estiloCorpo,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  icone?: Icone;
  children?: ReactNode;
  rodape?: ReactNode;
  /** Esc (e o X, se houver) chamam esta função. */
  aoFechar?: () => void;
  /** role="alertdialog" (confirmações) em vez de "dialog" */
  alerta?: boolean;
  fecharNoX?: boolean;
  largura?: number;
  estiloCorpo?: CSSProperties;
}) {
  const idT = useId();
  const idD = useId();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const alvo =
      caixa.current?.querySelector<HTMLElement>('footer .ps-btn.primary, footer .ps-btn.danger') ??
      caixa.current?.querySelector<HTMLElement>('button, a, input, textarea, select');
    alvo?.focus({ preventScroll: true });
    return () => {
      try {
        anterior?.focus({ preventScroll: true });
      } catch {
        /* elemento saiu da tela */
      }
    };
  }, []);

  useEffect(() => {
    if (!aoFechar) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  let ico: ReactNode = null;
  if (icone === 'ok')
    ico = (
      <div className="ico">
        <IcCheck lg />
      </div>
    );
  else if (icone === 'warning')
    ico = (
      <div className="ico warning">
        <IcAlerta lg />
      </div>
    );
  else if (icone === 'error')
    ico = (
      <div className="ico error">
        <IcInativar lg />
      </div>
    );
  else if (icone) ico = icone;

  const estilo: CSSProperties | undefined = largura ? { maxWidth: largura } : undefined;

  return (
    <div className="ps-scrim" style={{ position: 'fixed', inset: 0, borderRadius: 0, zIndex: 400 }}>
      <div
        ref={caixa}
        className="ps-modal"
        role={alerta ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={idT}
        aria-describedby={children ? idD : undefined}
        style={estilo}
      >
        {ico}
        <header style={ico ? { paddingTop: 14 } : undefined}>
          {subtitulo ? (
            <div style={{ flex: 1 }}>
              <h3 id={idT}>{titulo}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--Text-muted)' }}>{subtitulo}</p>
            </div>
          ) : (
            <h3 id={idT}>{titulo}</h3>
          )}
          {fecharNoX && aoFechar && (
            <button
              type="button"
              className="close"
              onClick={aoFechar}
              aria-label="Fechar"
              style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
            >
              <IcFechar lg />
            </button>
          )}
        </header>
        {children && (
          <div className="body" id={idD} style={estiloCorpo}>
            {children}
          </div>
        )}
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  );
}

/** "Tem certeza que deseja continuar? Essa ação não poderá ser desfeita." */
export function ModalCerteza({
  rotulo,
  aoConfirmar,
  aoCancelar,
  ocupado = false,
}: {
  rotulo: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  ocupado?: boolean;
}) {
  return (
    <Modal
      alerta
      icone="warning"
      titulo="Tem certeza que deseja continuar?"
      aoFechar={ocupado ? undefined : aoCancelar}
      rodape={
        <>
          <button type="button" className="ps-btn secondary cancelar" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className="ps-btn primary" onClick={aoConfirmar} aria-disabled={ocupado}>
            {ocupado ? 'Aguarde…' : rotulo}
          </button>
        </>
      }
    >
      Essa ação não poderá ser desfeita.
    </Modal>
  );
}
