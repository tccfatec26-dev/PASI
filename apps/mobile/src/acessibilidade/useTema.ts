import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { usePrefsA11y } from './preferencias';
import { CLARO, CONTRASTE, ESCURO, emCinza, type Paleta } from './tema';

/** Tema em uso: alto contraste > escuro (escolhido ou do celular) > claro; preto e branco por cima. */
export function useTema(): { cores: Paleta; escuro: boolean } {
  const prefs = usePrefsA11y();
  const sistema = useColorScheme();
  const escuro = prefs.tema === 'escuro' || (prefs.tema === 'sistema' && sistema === 'dark');
  return useMemo(() => {
    const base = prefs.contraste ? CONTRASTE : escuro ? ESCURO : CLARO;
    return { cores: prefs.pretoBranco ? emCinza(base) : base, escuro: escuro || prefs.contraste };
  }, [prefs.contraste, prefs.pretoBranco, escuro]);
}

/** Cores do tema atual, para o que não aceita className (ícones, placeholder, ActivityIndicator). */
export function useCores(): Paleta {
  return useTema().cores;
}

/**
 * Sem animação: opção "Reduzir movimento" do menu de acessibilidade ou a
 * preferência "Remover animações" do próprio celular.
 */
export function useMovimentoReduzido(): boolean {
  const { movimento } = usePrefsA11y();
  const [doSistema, setDoSistema] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setDoSistema)
      .catch(() => null);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setDoSistema);
    return () => sub.remove();
  }, []);
  return movimento || doSistema;
}
