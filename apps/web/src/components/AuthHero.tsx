import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IcVoltar } from './icons';

/** Lado azul das telas de acesso com botão Voltar e etiqueta (hero-top). */
export function AuthHeroTopo({
  voltar,
  aoVoltar,
  tag,
  titulo,
  children,
}: {
  voltar: string;
  /** Ação extra ao voltar (ex.: encerrar a sessão no primeiro acesso) */
  aoVoltar?: () => void;
  tag: string;
  titulo: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="hero-top">
      <div className="hero-row">
        <Link className="back-btn" to={voltar} onClick={aoVoltar} aria-label="Voltar" data-tip="Voltar">
          <IcVoltar />
        </Link>
        <span className="tag">{tag}</span>
      </div>
      <div>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
