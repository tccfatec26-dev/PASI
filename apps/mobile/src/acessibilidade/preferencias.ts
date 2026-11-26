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
 *
 * Desde 2026-11-25 o "Normal" é 16 (antes 14, que ficava pequeno no celular;
 * 16 é o antigo "Maior"): Normal 16, Maior 18, Muito maior 20.
 */
const REM_BASE = 16;
const ESCALA = [1, 1.125, 1.25] as const;
const CHAVE = '@pasi:a11y';
/**
 * Versão da escala gravada junto com as preferências. Sem ela (gravado antes
 * da troca), o nível escolhido desce um degrau para manter o mesmo tamanho:
 * o antigo "Maior" (≈16) é o novo "Normal".
 */
const VERSAO_ESCALA = 2;
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

const gravar = (p: PrefsA11y) =>
  AsyncStorage.setItem(CHAVE, JSON.stringify({ ...p, escala: VERSAO_ESCALA })).catch(() => null);

/** Carrega as preferências salvas (o App espera isso antes de mostrar a primeira tela). */
export async function carregarPrefs() {
  try {
    const salvo = JSON.parse((await AsyncStorage.getItem(CHAVE)) ?? 'null') as (Partial<PrefsA11y> & { escala?: number }) | null;
    if (salvo && typeof salvo === 'object' && salvo.escala !== VERSAO_ESCALA) {
      // gravado com a escala antiga: mesmo tamanho na nova (um degrau abaixo)
      const p = normalizar({ ...salvo, fonte: Math.max(0, (salvo.fonte ?? 0) - 1) as PrefsA11y['fonte'] });
      aplicar(p);
      gravar(p);
      return;
    }
    aplicar(normalizar(salvo));
  } catch {
    aplicar(PADRAO);
  }
}

export function definirPrefs(mudanca: Partial<PrefsA11y>) {
  const p = { ...atual, ...mudanca };
  aplicar(p);
  gravar(p);
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
