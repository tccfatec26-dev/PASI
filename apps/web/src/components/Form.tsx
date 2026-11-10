import { useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { D, Ic, IcAlerta, IcCadeado, IcChevron, IcErro, IcInfo, IcSucesso } from './icons';

/** Campo: rótulo + controle + ajuda (.ps-field). */
export function Campo({
  id,
  rotulo,
  obrigatorio,
  opcional,
  ajuda,
  erro,
  sucesso,
  children,
  estatico = false,
}: {
  id?: string;
  rotulo: ReactNode;
  obrigatorio?: boolean;
  opcional?: boolean;
  ajuda?: ReactNode;
  erro?: string | null;
  sucesso?: string | null;
  children: ReactNode;
  /** rótulo como <span> (campos só leitura) */
  estatico?: boolean;
}) {
  const conteudoRotulo = (
    <>
      {rotulo}
      {obrigatorio && (
        <>
          {' '}
          <span className="req" aria-hidden="true">
            *
          </span>
        </>
      )}
      {opcional && (
        <>
          {' '}
          <span className="opt">(opcional)</span>
        </>
      )}
    </>
  );
  return (
    <div className="ps-field">
      {estatico || !id ? (
        <span className="ps-label">{conteudoRotulo}</span>
      ) : (
        <label className="ps-label" htmlFor={id}>
          {conteudoRotulo}
        </label>
      )}
      {children}
      {erro && <div className="ps-helper error">{erro}</div>}
      {!erro && sucesso && <div className="ps-helper success">{sucesso}</div>}
      {ajuda && <div className="ps-helper">{ajuda}</div>}
    </div>
  );
}

/** Valor só leitura com cadeado (CPF, paciente etc.). */
export function SoLeitura({ valor, cadeado = true }: { valor: ReactNode; cadeado?: boolean }) {
  return (
    <div className="ps-control is-readonly">
      <span className="val">{valor}</span>
      {cadeado && <IcCadeado style={{ color: 'var(--Text-muted)' }} />}
    </div>
  );
}

export function Select({
  id,
  valor,
  aoMudar,
  children,
  invalido,
  desabilitado,
}: {
  id?: string;
  valor: string | number;
  aoMudar: (v: string) => void;
  children: ReactNode;
  invalido?: boolean;
  desabilitado?: boolean;
}) {
  return (
    <div className={'ps-control' + (invalido ? ' is-error' : '')}>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} aria-invalid={invalido || undefined} disabled={desabilitado}>
        {children}
      </select>
      <IcChevron style={{ color: 'var(--Link)' }} />
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  valor: string;
  aoMudar: (v: string) => void;
  icone?: ReactNode;
  invalido?: boolean;
  estado?: 'erro' | 'sucesso' | null;
};

export function Entrada({ valor, aoMudar, icone, invalido, estado, ...resto }: InputProps) {
  const cls = 'ps-control' + (invalido || estado === 'erro' ? ' is-error' : estado === 'sucesso' ? ' is-success' : '');
  return (
    <div className={cls}>
      {icone}
      <input value={valor} onChange={(e) => aoMudar(e.target.value)} aria-invalid={invalido || estado === 'erro' || undefined} {...resto} />
    </div>
  );
}

/** Campo de senha com cadeado e botão de mostrar/ocultar (olho). */
export function EntradaSenha({
  valor,
  aoMudar,
  estado,
  ...resto
}: Omit<InputProps, 'icone' | 'type'>) {
  const [ver, setVer] = useState(false);
  const rot = ver ? 'Ocultar senha' : 'Mostrar senha';
  const cls = 'ps-control' + (estado === 'erro' ? ' is-error' : estado === 'sucesso' ? ' is-success' : '');
  return (
    <div className={cls}>
      <IcCadeado style={{ color: 'var(--Text-muted)' }} />
      <input type={ver ? 'text' : 'password'} value={valor} onChange={(e) => aoMudar(e.target.value)} {...resto} />
      <button type="button" className="olho" onClick={() => setVer(!ver)} aria-label={rot} aria-pressed={ver} data-tip={rot}>
        <Ic d={ver ? D.olhoFechado : D.olho} />
      </button>
    </div>
  );
}

/** Lista de critérios da senha (.req-list). */
export function ListaCriterios({ criterios, rotulo }: { criterios: [string, boolean][]; rotulo: string }) {
  return (
    <ul className="req-list" aria-label={rotulo}>
      {criterios.map(([t, ok]) => (
        <li key={t} className={ok ? 'ok' : ''}>
          <Ic d={ok ? D.check : D.pendente} style={{ width: 16, height: 16 }} />
          {t}
          <span className="ps-sr">{ok ? ' (atendido)' : ' (pendente)'}</span>
        </li>
      ))}
    </ul>
  );
}

type TipoAlerta = 'info' | 'success' | 'warning' | 'error';

/** Aviso (.ps-alert) com ícone, título e texto. */
export function Alerta({
  tipo,
  titulo,
  children,
  acao,
  estilo,
  id,
}: {
  tipo: TipoAlerta;
  titulo?: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  estilo?: CSSProperties;
  id?: string;
}) {
  const icone =
    tipo === 'success' ? (
      <IcSucesso lg style={{ color: 'var(--Success)' }} />
    ) : tipo === 'warning' ? (
      <IcAlerta lg style={{ color: 'var(--Warning)' }} />
    ) : tipo === 'error' ? (
      <IcErro lg style={{ color: 'var(--Error)' }} />
    ) : (
      <IcInfo lg style={{ color: 'var(--Link)' }} />
    );
  return (
    <div className={`ps-alert ${tipo}`} role={tipo === 'error' || tipo === 'warning' ? 'alert' : 'status'} style={estilo} id={id}>
      {icone}
      <div className="body" style={acao ? { flex: 1 } : undefined}>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
      {acao}
    </div>
  );
}
