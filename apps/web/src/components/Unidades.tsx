import type { VinculoUnidade } from '../api/types';
import { ordenarUnidades } from '../lib/perfil';

/** Unidades em "kv" (com a etiqueta "sede"), como em Perfil e unidades. */
export function ListaUnidadesKv({ unidades }: { unidades: VinculoUnidade[] }) {
  const lista = ordenarUnidades(unidades);
  if (!lista.length) return <strong>—</strong>;
  return (
    <>
      {lista.map((u) =>
        u.sede ? (
          <strong key={u.id_unidade_atendimento} className="with-tag bul">
            {u.unidade_atendimento.nome}
            <em className="sede-tag">sede</em>
          </strong>
        ) : (
          <strong key={u.id_unidade_atendimento} className="bul" style={{ display: 'block' }}>
            {u.unidade_atendimento.nome}
          </strong>
        ),
      )}
    </>
  );
}
