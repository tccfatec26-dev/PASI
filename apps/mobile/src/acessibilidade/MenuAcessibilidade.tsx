import React, { useSyncExternalStore } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableOpacity } from './Leitura';
import { falar, vozDisponivel } from './fala';
import { definirPrefs, FONTE_MAX, redefinirPrefs, usePrefsA11y, type PrefsA11y } from './preferencias';
import { useCores, useMovimentoReduzido } from './useTema';
import { CamadaTema } from './CamadaTema';

/**
 * Menu de acessibilidade (RF04), com as mesmas opções do painel web — tamanho
 * do texto, alto contraste, preto e branco, reduzir movimento, leitura em voz
 * alta e redefinir — mais o tema (claro/escuro). Abre pelo botão do cabeçalho
 * de todas as telas (BotaoAcessibilidade).
 */

let aberto = false;
const ouvintes = new Set<() => void>();
const mudar = (v: boolean) => {
  aberto = v;
  ouvintes.forEach((f) => f());
};
export const abrirMenuAcessibilidade = () => mudar(true);
const fecharMenu = () => mudar(false);
const useAberto = () =>
  useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => aberto,
  );

const NOMES_FONTE = ['Normal', 'Maior', 'Muito maior'];
const TEMAS: { valor: PrefsA11y['tema']; rotulo: string }[] = [
  { valor: 'sistema', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

/** Botão do cabeçalho que abre o menu (ícone sobre o cabeçalho escuro). */
export function BotaoAcessibilidade() {
  const cores = useCores();
  return (
    <TouchableOpacity
      onPress={abrirMenuAcessibilidade}
      className="w-9 h-9 rounded-xl bg-sobre-primaria/15 items-center justify-center"
      accessibilityRole="button"
      accessibilityLabel="Abrir menu de acessibilidade"
      hitSlop={6}
    >
      <MaterialIcons name="accessibility-new" size={22} color={cores.sobrePrimaria} />
    </TouchableOpacity>
  );
}

function Interruptor({
  titulo,
  descricao,
  ligado,
  aoMudar,
  disabled,
}: {
  titulo: string;
  descricao?: string;
  ligado: boolean;
  aoMudar: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={aoMudar}
      disabled={disabled}
      textoFala={`${titulo}: ${ligado ? 'desligado' : 'ligado'}`}
      className={`flex-row items-center py-3 border-b border-border ${disabled ? 'opacity-60' : ''}`}
      accessibilityRole="switch"
      accessibilityLabel={titulo}
      accessibilityHint={descricao}
      accessibilityState={{ checked: ligado, disabled }}
    >
      <View className="flex-1 pr-3">
        <Text className="text-gray-800 text-base font-medium">{titulo}</Text>
        {descricao ? <Text className="text-gray-500 text-xs mt-0.5">{descricao}</Text> : null}
      </View>
      {!disabled && (
        <View className={`w-12 h-7 rounded-full justify-center px-1 ${ligado ? 'bg-primary border border-primary items-end' : 'bg-gray-100 border border-border items-start'}`}>
          <View className={`w-5 h-5 rounded-full ${ligado ? 'bg-sobre-primaria' : 'bg-muted'}`} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export function MenuAcessibilidade() {
  const visivel = useAberto();
  const prefs = usePrefsA11y();
  const cores = useCores();
  const semMovimento = useMovimentoReduzido();
  const insets = useSafeAreaInsets();
  const temVoz = vozDisponivel();

  const mudarFonte = (passo: number) => {
    const fonte = Math.min(Math.max(prefs.fonte + passo, 0), FONTE_MAX) as PrefsA11y['fonte'];
    definirPrefs({ fonte });
  };

  const alternarLeitura = () => {
    const ligar = !prefs.leitura;
    definirPrefs({ leitura: ligar });
    // ao ligar, a própria opção já avisa como funciona
    if (ligar) falar('Leitura em voz alta ligada. Toque em um texto, botão ou campo para ouvi-lo.');
  };

  return (
    <Modal visible={visivel} transparent animationType={semMovimento ? 'none' : 'slide'} onRequestClose={fecharMenu}>
      <CamadaTema>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="flex-1" onPress={fecharMenu} lerAoTocar={false} accessibilityLabel="Fechar menu de acessibilidade" />
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ maxHeight: '90%', paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="accessibility-new" size={22} color={cores.destaque} style={{ marginRight: 8 }} />
              <Text className="flex-1 text-primary font-bold text-lg" accessibilityRole="header">
                Acessibilidade
              </Text>
              <TouchableOpacity onPress={fecharMenu} accessibilityRole="button" accessibilityLabel="Fechar menu de acessibilidade" hitSlop={8}>
                <MaterialIcons name="close" size={24} color={cores.texto4} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tamanho do texto */}
              <View className="py-3 border-b border-border">
                <Text className="text-gray-800 text-base font-medium mb-2">Tamanho do texto</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => mudarFonte(-1)}
                    disabled={prefs.fonte === 0}
                    className={`w-12 h-11 rounded-xl border border-primary items-center justify-center ${prefs.fonte === 0 ? 'opacity-40' : ''}`}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir o tamanho do texto"
                  >
                    <Text className="text-primary font-bold text-sm">A-</Text>
                  </TouchableOpacity>
                  <Text className="flex-1 text-center text-gray-700 text-sm" accessibilityLiveRegion="polite">
                    {NOMES_FONTE[prefs.fonte]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => mudarFonte(1)}
                    disabled={prefs.fonte === FONTE_MAX}
                    className={`w-12 h-11 rounded-xl border border-primary items-center justify-center ${prefs.fonte === FONTE_MAX ? 'opacity-40' : ''}`}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar o tamanho do texto"
                  >
                    <Text className="text-primary font-bold text-lg">A+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tema */}
              <View className="py-3 border-b border-border">
                <Text className="text-gray-800 text-base font-medium">Tema</Text>
                <Text className="text-gray-500 text-xs mt-0.5 mb-2">O escuro cansa menos a vista em pouca luz. Automático segue o celular.</Text>
                <View className="flex-row gap-2" accessibilityRole="radiogroup">
                  {TEMAS.map((t) => {
                    const sel = prefs.tema === t.valor;
                    return (
                      <TouchableOpacity
                        key={t.valor}
                        onPress={() => definirPrefs({ tema: t.valor })}
                        textoFala={`Tema ${t.rotulo}`}
                        className={`flex-1 h-10 rounded-xl border items-center justify-center ${sel ? 'bg-primary border-primary' : 'bg-white border-border'}`}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: sel }}
                      >
                        <Text className={`text-sm font-medium ${sel ? 'text-white' : 'text-gray-700'}`}>{t.rotulo}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Interruptor titulo="Alto contraste" ligado={prefs.contraste} aoMudar={() => definirPrefs({ contraste: !prefs.contraste })} />
              <Interruptor titulo="Preto e branco" ligado={prefs.pretoBranco} aoMudar={() => definirPrefs({ pretoBranco: !prefs.pretoBranco })} />
              <Interruptor
                titulo="Reduzir movimento"
                descricao="Desliga animações e transições."
                ligado={prefs.movimento}
                aoMudar={() => definirPrefs({ movimento: !prefs.movimento })}
              />
              <Interruptor
                titulo="Leitura em voz alta"
                descricao={temVoz ? 'Toque em um texto, botão ou campo para ouvi-lo.' : 'Indisponível neste aparelho.'}
                ligado={prefs.leitura}
                aoMudar={alternarLeitura}
                disabled={!temVoz}
              />

              <TouchableOpacity
                onPress={redefinirPrefs}
                className="mt-4 mb-2 h-12 rounded-xl border border-border items-center justify-center flex-row gap-2"
                accessibilityRole="button"
              >
                <MaterialIcons name="restart-alt" size={18} color={cores.texto3} />
                <Text className="text-gray-600 font-medium">Redefinir preferências</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </CamadaTema>
    </Modal>
  );
}
