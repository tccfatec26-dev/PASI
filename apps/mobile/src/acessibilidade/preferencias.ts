import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rem } from 'nativewind';

/**
 * Preferências de acessibilidade do app (docs/requisitos_acessibilidade.md,
 * RF02/RF04/RF05), as mesmas do painel web, mais o tema (claro/escuro).
 * Ficam no aparelho (AsyncStorage) e valem em todas as telas, inclusive depois
 * de fechar o app.
 */
export interface PrefsA11y {
  /** 0 = normal, 1 = maior, 2 = muito maior */
  fonte: 0 | 1 | 2;
  contraste: boolean;
  pretoBranco: boolean;
  leitura: boolean;
  /** desliga animações e transições */
  movimento: boolean;
  /** "sistema" segue o modo escuro do celular */
  tema: 'sistema' | 'claro' | 'escuro';
}

export const FONTE_MAX = 2;
/**
 * Tamanho base do texto (rem do NativeWind; o padrão dele é 14). As classes
 * text-xs, text-sm... e os espaçamentos em rem crescem juntos, como o zoom de
 * texto do painel web.
 */
const REM_BASE = 14;
const ESCALA = [1, 1.15, 1.3] as const;
const CHAVE = '@pasi:a11y';
const PADRAO: PrefsA11y = { fonte: 0, contraste: false, pretoBranco: false, leitura: false, movimento: false, tema: 'sistema' };

let atual: PrefsA11y = PADRAO;
const ouvintes = new Set<() => void>();
const aoDesligarLeitura = new Set<() => void>();

function normalizar(v: Partial<PrefsA11y> | null): PrefsA11y {
  if (!v || typeof v !== 'object') return PADRAO;
  return {
    fonte: v.fonte === 1 || v.fonte === 2 ? v.fonte : 0,
    contraste: !!v.contraste,
    pretoBranco: !!v.pretoBranco,
    leitura: !!v.leitura,
    movimento: !!v.movimento,
    tema: v.tema === 'claro' || v.tema === 'escuro' ? v.tema : 'sistema',
  };
}

function aplicar(p: PrefsA11y) {
  if (atual.leitura && !p.leitura) aoDesligarLeitura.forEach((f) => f());
  rem.set(REM_BASE * ESCALA[p.fonte]);
  atual = p;
  ouvintes.forEach((f) => f());
}

/** Carrega as preferências salvas (o App espera isso antes de mostrar a primeira tela). */
export async function carregarPrefs() {
  try {
    aplicar(normalizar(JSON.parse((await AsyncStorage.getItem(CHAVE)) ?? 'null')));
  } catch {
    aplicar(PADRAO);
  }
}

export function definirPrefs(mudanca: Partial<PrefsA11y>) {
  const p = { ...atual, ...mudanca };
  aplicar(p);
  AsyncStorage.setItem(CHAVE, JSON.stringify(p)).catch(() => null);
}

/** Volta tudo ao padrão (o tema também volta a seguir o celular). */
export function redefinirPrefs() {
  aplicar(PADRAO);
  AsyncStorage.removeItem(CHAVE).catch(() => null);
}

export const prefsAtuais = () => atual;

/** Chamado quando a leitura em voz alta é desligada (para calar a fala em andamento). */
export function quandoDesligarLeitura(f: () => void) {
  aoDesligarLeitura.add(f);
  return () => aoDesligarLeitura.delete(f);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Preferências atuais (re-renderiza quando mudam). */
export function usePrefsA11y(): PrefsA11y {
  return useSyncExternalStore(assinar, () => atual, () => PADRAO);
}
