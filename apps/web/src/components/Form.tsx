import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { lerAviso } from '../lib/acessibilidade';
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
  const idErro = id ? `${id}-erro` : undefined;
  const idAjuda = id ? `${id}-ajuda` : undefined;
  const temErro = !!erro;
  const temSucesso = !erro && !!sucesso;
  const temAjuda = !!ajuda;
  // RF06: liga o controle (id) às mensagens de erro/ajuda, para o leitor de tela
  // anunciá-las junto com o campo. Feito no DOM para valer para qualquer controle
  // (Entrada, Select, textarea, input solto) sem mudar cada tela.
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const ids = [temErro || temSucesso ? idErro : null, temAjuda ? idAjuda : null].filter(Boolean).join(' ');
    if (ids) el.setAttribute('aria-describedby', ids);
    else el.removeAttribute('aria-describedby');
    // marca o aria-invalid que foi posto aqui, para tirar só esse quando o erro sumir
    // (o das Entradas com "invalido" continua sendo controlado pelo React)
    if (temErro) {
      el.setAttribute('aria-invalid', 'true');
      el.dataset.erroCampo = '1';
    } else if (el.dataset.erroCampo) {
      el.removeAttribute('aria-invalid');
      delete el.dataset.erroCampo;
    }
  }, [id, idErro, idAjuda, temErro, temSucesso, temAjuda]);
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
      {erro && (
        <div className="ps-helper error" id={idErro} role="alert">
          {erro}
        </div>
      )}
      {!erro && sucesso && (
        <div className="ps-helper success" id={idErro}>
          {sucesso}
        </div>
      )}
      {ajuda && (
        <div className="ps-helper" id={idAjuda}>
          {ajuda}
        </div>
      )}
    </div>
  );
}

/**
 * Mensagem de erro solta (fora do <Campo>), RF06: anunciada pelo leitor de tela ao
 * aparecer (role="alert") e com id para o campo apontar a ela via aria-describedby.
 */
export function MensagemErro({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div className="ps-helper error" id={id} role="alert">
      {children}
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
  rotuladoPor,
  descritoPor,
}: {
  id?: string;
  valor: string | number;
  aoMudar: (v: string) => void;
  children: ReactNode;
  invalido?: boolean;
  desabilitado?: boolean;
  /** id do elemento que serve de rótulo, quando não há <label> (ex.: título do painel) */
  rotuladoPor?: string;
  /** id da mensagem de erro/ajuda ligada ao campo */
  descritoPor?: string;
}) {
  return (
    // ps-select: a lista ocupa o campo inteiro (a seta também abre)
    <div className={'ps-control ps-select' + (invalido ? ' is-error' : '') + (desabilitado ? ' is-disabled' : '')}>
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={invalido || undefined}
        aria-labelledby={rotuladoPor}
        aria-describedby={descritoPor}
        disabled={desabilitado}
      >
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
  invalido,
  ...resto
}: Omit<InputProps, 'icone' | 'type'>) {
  const [ver, setVer] = useState(false);
  const rot = ver ? 'Ocultar senha' : 'Mostrar senha';
  const cls = 'ps-control' + (invalido || estado === 'erro' ? ' is-error' : estado === 'sucesso' ? ' is-success' : '');
  return (
    <div className={cls}>
      <IcCadeado style={{ color: 'var(--Text-muted)' }} />
      <input
        type={ver ? 'text' : 'password'}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={invalido || estado === 'erro' || undefined}
        {...resto}
      />
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
        <Criterio key={t} texto={t} ok={ok} />
      ))}
    </ul>
  );
}

/** Um critério: anima quando passa a ser atendido (.ok) e quando deixa de ser (.perdeu). */
function Criterio({ texto, ok }: { texto: string; ok: boolean }) {
  // guarda o valor anterior para saber se o critério acabou de deixar de ser atendido
  const [anterior, setAnterior] = useState(ok);
  const [perdeu, setPerdeu] = useState(false);
  if (anterior !== ok) {
    setAnterior(ok);
    setPerdeu(anterior && !ok);
  }
  return (
    <li
      className={ok ? 'ok' : perdeu ? 'perdeu' : ''}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'crit-perde') setPerdeu(false);
      }}
    >
      <Ic d={ok ? D.check : D.pendente} style={{ width: 16, height: 16 }} />
      {texto}
      <span className="ps-sr">{ok ? ' (atendido)' : ' (pendente)'}</span>
    </li>
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
  const caixa = useRef<HTMLDivElement>(null);
  // RF05/RF06: com a leitura em voz alta ligada, alertas de erro são lidos ao aparecer
  const textoErro = tipo === 'error' ? `${typeof titulo === 'string' ? titulo : ''}|${typeof children === 'string' ? children : ''}` : '';
  useEffect(() => {
    if (tipo !== 'error' || !caixa.current) return;
    // título e texto em linhas separadas viram frases separadas na leitura
    lerAviso('Erro. ' + caixa.current.innerText.split(/\n+/).map((t) => t.trim()).filter(Boolean).join('. '));
  }, [tipo, textoErro]);
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
    <div ref={caixa} className={`ps-alert ${tipo}`} role={tipo === 'error' || tipo === 'warning' ? 'alert' : 'status'} style={estilo} id={id}>
      {icone}
      <div className="body" style={acao ? { flex: 1 } : undefined}>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
      {acao}
    </div>
  );
}
