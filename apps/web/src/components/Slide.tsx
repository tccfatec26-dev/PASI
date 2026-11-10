import { useId } from 'react';
import { D, Ic } from './icons';

/** Volta o puxador ao início (ex.: a pessoa cancelou a confirmação). */
export function resetarSlides() {
  setTimeout(() => {
    const w = window as unknown as { pasiSlideReset?: () => void };
    w.pasiSlideReset?.();
  }, 0);
}

/**
 * "Deslize para …" (.slide). O arraste e o teclado vêm de behaviors/slide.js,
 * que clica no botão oculto .slide-done quando o puxador chega ao fim.
 */
export function Slide({
  texto,
  rotuloAcessivel,
  ajuda,
  liberado,
  dicaBloqueado,
  aoConcluir,
  rotuloBotao,
  classeExtra,
}: {
  texto: string;
  rotuloAcessivel: string;
  ajuda: string;
  liberado: boolean;
  dicaBloqueado?: string;
  aoConcluir: () => void;
  rotuloBotao: string;
  classeExtra?: string;
}) {
  const idAjuda = useId();
  return (
    <div className={['slide-wrap', classeExtra ?? ''].filter(Boolean).join(' ')}>
      <div className={'slide' + (liberado ? '' : ' is-off')}>
        <span className="slide-fill" aria-hidden="true" />
        <span className="slide-txt" aria-hidden="true">
          {texto}
        </span>
        <span
          className="slide-knob"
          role="slider"
          tabIndex={0}
          aria-label={rotuloAcessivel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-disabled={!liberado}
          aria-describedby={idAjuda}
          data-tip={liberado ? '' : (dicaBloqueado ?? '')}
        >
          <Ic d={D.cadeado} className="k-cadeado" />
          <Ic d={D.seta} className="k-seta" />
        </span>
        <button
          type="button"
          className="slide-done"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => {
            if (liberado) aoConcluir();
          }}
        >
          {rotuloBotao}
        </button>
      </div>
      <p className="slide-help" id={idAjuda}>
        {ajuda}
      </p>
    </div>
  );
}
