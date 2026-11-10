import type { CSSProperties, ReactNode } from 'react';

/** Ícone no padrão do protótipo: <svg class="ic"> com traço de 2px. */
export function Ic({
  d,
  children,
  lg = false,
  className,
  style,
}: {
  d?: string;
  children?: ReactNode;
  lg?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg className={['ic', lg ? 'lg' : '', className ?? ''].filter(Boolean).join(' ')} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {d ? <path d={d} /> : children}
    </svg>
  );
}

type P = { lg?: boolean; style?: CSSProperties; className?: string };

// Caminhos usados pelo protótipo
export const D = {
  voltar: 'M19 12H5M11 6l-6 6 6 6',
  mais: 'M12 5v14M5 12h14',
  lapis: 'M4 20h4L20 8l-4-4L4 16z',
  lapisLinha: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  seta: 'M5 12h14M13 6l6 6-6 6',
  cadeado: 'M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4',
  cadeadoAberto: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2',
  check: 'M20 6 9 17l-5-5',
  checkCirculo: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l3 3 5-6',
  pendente: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  relogio: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  proibido: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM5.6 5.6l12.8 12.8',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v5M12 8h0',
  alerta: 'M12 3 2 20h20zM12 10v4M12 17h0',
  erro: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v5M12 16h0',
  chevronBaixo: 'm6 9 6 6 6-6',
  chevronEsq: 'm15 6-6 6 6 6',
  chevronDir: 'm9 6 6 6-6 6',
  fechar: 'M6 6l12 12M18 6 6 18',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  olhoFechado:
    'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.4 9.4 0 0 0 4.2-1',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  email: 'M3 5h18v14H3zM3 7l9 6 9-6',
  respostas: 'M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4',
  avaliar: 'M9 2h6v4H9zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4',
  inbox: 'M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z',
  novoDoc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6',
  lixeira: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3',
};

export const IcVoltar = (p: P) => <Ic d={D.voltar} {...p} />;
export const IcMais = (p: P) => <Ic d={D.mais} {...p} />;
export const IcLapis = (p: P) => <Ic d={D.lapis} {...p} />;
export const IcChevron = (p: P) => <Ic d={D.chevronBaixo} {...p} />;
export const IcFechar = (p: P) => <Ic d={D.fechar} {...p} />;
export const IcCheck = (p: P) => <Ic d={D.check} {...p} />;

export const IcInfo = (p: P) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h0" />
  </Ic>
);
export const IcAlerta = (p: P) => (
  <Ic {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17h0" />
  </Ic>
);
export const IcErro = (p: P) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h0" />
  </Ic>
);
export const IcSucesso = (p: P) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </Ic>
);
export const IcEmail = (p: P) => (
  <Ic {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Ic>
);
export const IcCadeado = (p: P) => (
  <Ic {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Ic>
);
export const IcCadeadoMenu = (p: P) => (
  <Ic {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Ic>
);
export const IcBusca = (p: P) => (
  <Ic {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Ic>
);
export const IcFiltro = (p: P) => (
  <Ic {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Ic>
);
export const IcOlhoAcao = (p: P) => (
  <Ic {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Ic>
);
export const IcEncerrar = (p: P) => <Ic d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" {...p} />;
export const IcInativar = (p: P) => (
  <Ic {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Ic>
);
export const IcFormulario = (p: P) => (
  <Ic {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Ic>
);
export const IcAtendimentos = (p: P) => (
  <Ic {...p}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </Ic>
);
export const IcPessoa = (p: P) => (
  <Ic {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Ic>
);
export const IcUsuarios = (p: P) => (
  <Ic {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0 1 14 0" />
    <path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" />
  </Ic>
);
