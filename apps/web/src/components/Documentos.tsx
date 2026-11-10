import { useRef, useState, type DragEvent } from 'react';
import * as docApi from '../api/documentos';
import type { Documento } from '../api/documentos';
import { mensagemErro } from '../api/client';
import { data } from '../lib/format';
import { IcFormulario, Ic } from './icons';

const BAIXAR = 'M12 4v12M7 11l5 5 5-5M4 20h16';
const LIXEIRA = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';
const ENVIAR = 'M12 16V4M7 9l5-5 5 5M4 20h16';

/** Um arquivo (.ps-file) com baixar e, opcionalmente, excluir. */
export function ArquivoDoc({ doc, aoExcluir }: { doc: Documento; aoExcluir?: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      <div className="ps-file">
        <span className="fi">
          <IcFormulario lg />
        </span>
        <div className="meta">
          <div className="name">{doc.nome_fisico || `Documento ${doc.id_documento}`}</div>
          <div className="sub">Enviado em {data(doc.dt_cadastro)}</div>
        </div>
        <button
          type="button"
          className="act tt"
          aria-label="Baixar arquivo"
          data-tip="Baixar arquivo"
          onClick={() => docApi.baixar(doc).catch((e) => setErro(mensagemErro(e)))}
        >
          <Ic d={BAIXAR} />
        </button>
        {aoExcluir && (
          <button type="button" className="act tt danger" aria-label="Excluir arquivo" data-tip="Excluir arquivo" onClick={aoExcluir}>
            <Ic d={LIXEIRA} />
          </button>
        )}
      </div>
      {erro && <div className="ps-helper error">{erro}</div>}
    </>
  );
}

/** Área para soltar ou escolher um arquivo (.ps-drop). */
export function SoltarArquivo({ aoEscolher, enviando }: { aoEscolher: (f: File) => void; enviando?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setSobre(false);
    const f = e.dataTransfer.files?.[0];
    if (f) aoEscolher(f);
  };
  return (
    <div
      className={'ps-drop' + (sobre ? ' is-over' : '')}
      onDragOver={(e) => {
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={soltar}
    >
      <span className="ico">
        <Ic d={ENVIAR} lg />
      </span>
      <strong>{enviando ? 'Enviando…' : 'Arraste um arquivo ou escolha'}</strong>
      <span>Até 10 MB por arquivo.</span>
      <button type="button" className="ps-btn secondary sm" onClick={() => input.current?.click()} disabled={enviando}>
        Escolher arquivo
      </button>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) aoEscolher(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
