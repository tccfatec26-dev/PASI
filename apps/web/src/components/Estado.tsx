import { Alerta } from './Form';

/** Carregando ou erro ao abrir uma tela de detalhe. */
export function Estado({ texto, erro = false }: { texto: string; erro?: boolean }) {
  return (
    <div className="page-body">
      {erro ? (
        <Alerta tipo="error" titulo="Não foi possível abrir">
          {texto}
        </Alerta>
      ) : (
        <p className="ps-results-meta" role="status">
          {texto}
        </p>
      )}
    </div>
  );
}
