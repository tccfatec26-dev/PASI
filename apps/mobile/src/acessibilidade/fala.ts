import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';
import { prefsAtuais, quandoDesligarLeitura } from './preferencias';

/**
 * Leitura em voz alta (RF05), com a síntese de voz do próprio celular
 * (expo-speech; no Android, o mecanismo de voz do sistema), em português do
 * Brasil e sem serviço externo. Uma nova leitura interrompe a anterior;
 * desligar a opção cala o que estiver sendo lido.
 */

/** O aparelho não tem voz (ou a fala deu erro): a opção aparece como indisponível. */
let indisponivel = false;
export const vozDisponivel = () => !indisponivel;

export const leituraAtiva = () => prefsAtuais().leitura && vozDisponivel();

const limpar = (t: string) => t.replace(/\s+/g, ' ').trim();

/**
 * Lê um texto. `interromper` false entra na fila (avisos não devem calar a
 * leitura do botão que acabou de ser tocado).
 */
export function falar(texto: string, interromper = true) {
  const t = limpar(texto);
  if (!t || indisponivel) return;
  try {
    if (interromper) void Speech.stop();
    Speech.speak(t, {
      language: 'pt-BR',
      onError: () => {
        indisponivel = true;
      },
    });
  } catch {
    indisponivel = true;
  }
}

/** Lê `texto` se a leitura em voz alta estiver ligada. */
export function lerSeAtivo(texto: string | undefined | null) {
  if (texto && leituraAtiva()) falar(texto);
}

/**
 * Aviso do sistema (toast, erro): vai para o leitor de tela (TalkBack) e, com
 * a leitura em voz alta ligada, também é falado — sem cortar a fala em
 * andamento. O mesmo aviso repetido em seguida é lido uma vez só.
 */
let ultimo = { texto: '', quando: 0 };
export function lerAviso(texto: string) {
  AccessibilityInfo.announceForAccessibility(texto);
  if (!leituraAtiva()) return;
  const agora = Date.now();
  if (texto === ultimo.texto && agora - ultimo.quando < 1500) return;
  ultimo = { texto, quando: agora };
  falar(texto, false);
}

export function pararFala() {
  void Speech.stop().catch(() => null);
}

quandoDesligarLeitura(pararFala);
