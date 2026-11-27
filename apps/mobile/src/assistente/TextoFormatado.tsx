import React from 'react';
import { View, Linking } from 'react-native';
import { Text } from '../acessibilidade/Leitura';

/**
 * A API do PASIBot responde em markdown simples (negrito, itálico, listas,
 * tabelas e links). Versão React Native do TextoFormatado da landing page:
 * mesmos blocos, montados com <Text>, sem interpretar HTML vindo de fora.
 */

const PADRAO_INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|https?:\/\/[^\s<>()]+)/g;

const abrir = (url: string) => {
  void Linking.openURL(url).catch(() => undefined);
};

function inline(texto: string, chave: string, corTexto: string) {
  return texto.split(PADRAO_INLINE).map((parte, i) => {
    const k = `${chave}-${i}`;
    if (!parte) return null;
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return (
        <Text key={k} className={`font-bold ${corTexto}`}>
          {parte.slice(2, -2)}
        </Text>
      );
    }
    if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) {
      return (
        <Text key={k} className={`italic ${corTexto}`}>
          {parte.slice(1, -1)}
        </Text>
      );
    }
    if (/^https?:\/\//.test(parte)) {
      const sobra = parte.match(/[.,;:!?]+$/)?.[0] ?? '';
      const url = sobra ? parte.slice(0, -sobra.length) : parte;
      return (
        <Text key={k} className={corTexto}>
          <Text className="text-primary underline font-semibold" onPress={() => abrir(url)} accessibilityRole="link">
            {url.replace(/^https?:\/\//, '')}
          </Text>
          {sobra}
        </Text>
      );
    }
    return parte;
  });
}

type Bloco =
  | { tipo: 'p'; linhas: string[] }
  | { tipo: 'ul' | 'ol'; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

/** "| a | b |" -> ["a", "b"] */
function celulas(linha: string) {
  return linha
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const SEPARADOR_TABELA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function blocos(texto: string): Bloco[] {
  const resultado: Bloco[] = [];
  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = bruta.trim();
    const ultimo = resultado[resultado.length - 1];
    if (!linha) {
      resultado.push({ tipo: 'p', linhas: [] });
      continue;
    }
    if (linha.startsWith('|')) {
      if (SEPARADOR_TABELA.test(linha)) continue;
      if (ultimo && ultimo.tipo === 'tabela') ultimo.linhas.push(celulas(linha));
      else resultado.push({ tipo: 'tabela', cabecalho: celulas(linha), linhas: [] });
      continue;
    }
    const marcador = linha.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (marcador) {
      const tipo = /\d/.test(marcador[1]) ? 'ol' : 'ul';
      if (ultimo && ultimo.tipo === tipo) ultimo.itens.push(marcador[2]);
      else resultado.push({ tipo, itens: [marcador[2]] });
      continue;
    }
    // títulos em markdown viram parágrafos comuns
    const semTitulo = linha.replace(/^#+\s*/, '');
    if (ultimo && ultimo.tipo === 'p') ultimo.linhas.push(semTitulo);
    else resultado.push({ tipo: 'p', linhas: [semTitulo] });
  }
  return resultado.filter((b) => {
    if (b.tipo === 'p') return b.linhas.length > 0;
    if (b.tipo === 'tabela') return b.linhas.length > 0 || b.cabecalho.length > 0;
    return b.itens.length > 0;
  });
}

const ehTelefone = (coluna: string) => /telefone|fone|contato/i.test(coluna);

/** Cada linha da tabela vira um cartão: na tela do celular, uma tabela larga não cabe. */
function TabelaEmCartoes({ cabecalho, linhas, chave }: { cabecalho: string[]; linhas: string[][]; chave: string }) {
  const cor = 'text-gray-800';
  if (linhas.length === 0) {
    return <Text className={`text-sm leading-5 ${cor}`}>{inline(cabecalho.join(' · '), chave, cor)}</Text>;
  }
  return (
    <View>
      {linhas.map((linha, i) => (
        <View key={i} className="bg-gray-50 border border-border rounded-xl p-3 mt-2">
          <Text className="text-sm font-bold text-primary mb-1">
            {inline(linha[0] ?? '', `${chave}-${i}-t`, 'text-primary')}
          </Text>
          {cabecalho.slice(1).map((coluna, j) => {
            const valor = linha[j + 1];
            if (!valor || valor === '-' || valor === '—') return null;
            const digitos = valor.replace(/\D/g, '');
            const telefone = ehTelefone(coluna) && digitos.length >= 10 && digitos.length <= 11;
            return (
              <View key={j} className="mt-1">
                <Text className="text-xs font-semibold text-gray-600">{coluna.replace(/\*+$/, '')}</Text>
                {telefone ? (
                  <Text
                    className="text-sm text-primary underline font-semibold"
                    onPress={() => abrir(`tel:+55${digitos}`)}
                    accessibilityRole="link"
                    accessibilityLabel={`Ligar para ${valor}`}
                  >
                    {valor}
                  </Text>
                ) : (
                  <Text className={`text-sm leading-5 ${cor}`}>{inline(valor, `${chave}-${i}-${j}`, cor)}</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function TextoFormatado({ texto }: { texto: string }) {
  const cor = 'text-gray-800';
  return (
    <View>
      {blocos(texto).map((bloco, i) => {
        const espaco = i > 0 ? 'mt-2' : '';
        if (bloco.tipo === 'p') {
          return (
            <Text key={i} className={`text-sm leading-5 ${cor} ${espaco}`}>
              {bloco.linhas.map((linha, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? '\n' : null}
                  {inline(linha, `${i}-${j}`, cor)}
                </React.Fragment>
              ))}
            </Text>
          );
        }
        if (bloco.tipo === 'tabela') {
          return (
            <View key={i} className={espaco}>
              <TabelaEmCartoes cabecalho={bloco.cabecalho} linhas={bloco.linhas} chave={String(i)} />
            </View>
          );
        }
        return (
          <View key={i} className={espaco}>
            {bloco.itens.map((item, j) => (
              <View key={j} className="flex-row mt-1">
                <Text className={`text-sm leading-5 ${cor} w-5`}>{bloco.tipo === 'ol' ? `${j + 1}.` : '•'}</Text>
                <Text className={`flex-1 text-sm leading-5 ${cor}`}>{inline(item, `${i}-${j}`, cor)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
