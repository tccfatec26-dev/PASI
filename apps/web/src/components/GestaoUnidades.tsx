import { useState } from 'react';
import * as apoio from '../api/apoio';
import type { VinculoUnidade } from '../api/types';
import { useCarregar } from '../hooks';
import { Select } from './Form';
import { Modal } from './Modal';
import { Ic } from './icons';
import { data } from '../lib/format';

const PREDIO = 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6';
const ESTRELA = 'M12 3l2.9 5.9 6.1.9-4.5 4.3 1.1 6.1L12 17.3 6.4 20.2l1.1-6.1L3 9.8l6.1-.9z';
const DESVINCULAR = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16';

/** Linha de unidade com "sede", origem do vínculo e as ações de gestão. */
export function ItemUnidade({
  un,
  so1,
  gerir,
  aoTornarSede,
  aoTirar,
}: {
  un: VinculoUnidade;
  so1: boolean;
  gerir: boolean;
  aoTornarSede: () => void;
  aoTirar: () => void;
}) {
  const tirarOff = un.sede || so1;
  const tirarTip = so1
    ? 'Não dá para desvincular: o profissional precisa ficar com pelo menos uma unidade'
    : un.sede
      ? 'Para desvincular a sede, marque outra unidade como sede antes'
      : 'Desvincular unidade';
  return (
    <div className="item">
      <span className="ico">
        <Ic d={PREDIO} lg />
      </span>
      <div className="meta">
        <strong className="with-tag">
          {un.unidade_atendimento.nome}
          {un.sede && <em className="sede-tag">sede</em>}
        </strong>
        <span>
          Vinculada{un.usuario_vinculo ? ` por ${un.usuario_vinculo.nome}` : ''} em {data(un.dt_vinculo)}
        </span>
      </div>
      {gerir && (
        <div className="acts">
          {!un.sede && (
            <button type="button" className="act tt" aria-label="Tornar sede" data-tip="Tornar sede" onClick={aoTornarSede}>
              <Ic d={ESTRELA} />
            </button>
          )}
          <button
            type="button"
            className="act tt danger"
            aria-disabled={tirarOff}
            aria-label={tirarTip}
            data-tip={tirarTip}
            onClick={() => {
              if (!tirarOff) aoTirar();
            }}
          >
            <Ic d={DESVINCULAR} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfirmaSimples({
  titulo,
  texto,
  botao,
  perigo = false,
  ocupado,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string;
  texto: string;
  botao: string;
  perigo?: boolean;
  ocupado: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  return (
    <Modal
      alerta
      titulo={titulo}
      aoFechar={ocupado ? undefined : aoFechar}
      rodape={
        <>
          <button type="button" className="ps-btn secondary cancelar" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className={'ps-btn ' + (perigo ? 'danger' : 'primary')} onClick={aoConfirmar} aria-busy={ocupado}>
            {ocupado ? 'Aguarde…' : botao}
          </button>
        </>
      }
    >
      {texto}
    </Modal>
  );
}

export function ModalVincular({
  nome,
  fem,
  jaVinculadas,
  ocupado,
  aoFechar,
  aoVincular,
  texto,
}: {
  texto?: string;
  nome: string;
  fem: boolean;
  jaVinculadas: number[];
  ocupado: boolean;
  aoFechar: () => void;
  aoVincular: (id: number, sede: boolean, nome: string) => void;
}) {
  const { dados: todas } = useCarregar(() => apoio.unidades(), []);
  const [idUn, setIdUn] = useState<number | ''>('');
  const [sede, setSede] = useState(false);
  const [erro, setErro] = useState(false);
  const livres = (todas ?? []).filter((x) => !jaVinculadas.includes(x.id_unidade_atendimento));
  return (
    <Modal
      titulo="Vincular unidade"
      aoFechar={ocupado ? undefined : aoFechar}
      estiloCorpo={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      rodape={
        <>
          <button type="button" className="ps-btn secondary cancelar" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className="ps-btn primary"
            aria-busy={ocupado}
            onClick={() => {
              if (idUn === '') {
                setErro(true);
                return;
              }
              aoVincular(idUn, sede, livres.find((x) => x.id_unidade_atendimento === idUn)?.nome ?? 'A unidade');
            }}
          >
            {ocupado ? 'Vinculando…' : 'Vincular'}
          </button>
        </>
      }
    >
      <span>
        {texto ?? `Escolha outra unidade em que ${nome} atende. ${fem ? 'Ela' : 'Ele'} passa a ver os atendimentos dessa unidade.`}
      </span>
      <div className="ps-field">
        <label className="ps-label" htmlFor="nova-un">
          Unidade de atendimento
        </label>
        <Select id="nova-un" valor={idUn} aoMudar={(v) => setIdUn(v ? Number(v) : '')} invalido={erro && idUn === ''}>
          <option value="">{todas ? 'Selecione a unidade' : 'Carregando…'}</option>
          {livres.map((x) => (
            <option key={x.id_unidade_atendimento} value={x.id_unidade_atendimento}>
              {x.nome}
            </option>
          ))}
        </Select>
        {erro && idUn === '' && <div className="ps-helper error">Escolha a unidade.</div>}
        <div className="ps-helper">Só aparecem unidades ainda não vinculadas.</div>
      </div>
      <button
        type="button"
        className={'ps-check' + (sede ? ' is-checked' : '')}
        aria-pressed={sede}
        onClick={() => setSede(!sede)}
        style={{ background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span className="ps-box">{sede ? '✓' : ''}</span>
        <span>Marcar como nova sede</span>
      </button>
    </Modal>
  );
}
