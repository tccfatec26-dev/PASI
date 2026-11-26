import type { ReactNode } from "react";

// A API responde em markdown simples (negrito, itálico, listas, tabelas e links).
// Montamos os elementos React à mão, sem innerHTML, para nunca injetar HTML vindo de fora.

const PADRAO_INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|https?:\/\/[^\s<>()]+)/g;

function inline(texto: string, chave: string): ReactNode[] {
  return texto.split(PADRAO_INLINE).map((parte, i) => {
    if (!parte) return null;
    if (parte.startsWith("**") && parte.endsWith("**")) {
      return <strong key={`${chave}-${i}`}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.length > 2 && parte.startsWith("*") && parte.endsWith("*")) {
      return <em key={`${chave}-${i}`}>{parte.slice(1, -1)}</em>;
    }
    if (/^https?:\/\//.test(parte)) {
      const sobra = parte.match(/[.,;:!?]+$/)?.[0] ?? "";
      const url = sobra ? parte.slice(0, -sobra.length) : parte;
      return (
        <span key={`${chave}-${i}`}>
          <a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https?:\/\//, "")}</a>
          {sobra}
        </span>
      );
    }
    return parte;
  });
}

type Bloco =
  | { tipo: "p"; linhas: string[] }
  | { tipo: "ul" | "ol"; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

/** "| a | b |" -> ["a", "b"] */
function celulas(linha: string) {
  return linha.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const SEPARADOR_TABELA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function blocos(texto: string): Bloco[] {
  const resultado: Bloco[] = [];
  for (const bruta of texto.replace(/\r/g, "").split("\n")) {
    const linha = bruta.trim();
    const ultimo = resultado[resultado.length - 1];
    if (!linha) {
      resultado.push({ tipo: "p", linhas: [] });
      continue;
    }
    // tabela em markdown: a 1ª linha é o cabeçalho, a linha de traços é ignorada
    if (linha.startsWith("|")) {
      if (SEPARADOR_TABELA.test(linha)) continue;
      if (ultimo && ultimo.tipo === "tabela") ultimo.linhas.push(celulas(linha));
      else resultado.push({ tipo: "tabela", cabecalho: celulas(linha), linhas: [] });
      continue;
    }
    const marcador = linha.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (marcador) {
      const tipo = /\d/.test(marcador[1]) ? "ol" : "ul";
      if (ultimo && ultimo.tipo === tipo) ultimo.itens.push(marcador[2]);
      else resultado.push({ tipo, itens: [marcador[2]] });
      continue;
    }
    if (ultimo && ultimo.tipo === "p") ultimo.linhas.push(linha);
    else resultado.push({ tipo: "p", linhas: [linha] });
  }
  return resultado.filter((b) => {
    if (b.tipo === "p") return b.linhas.length > 0;
    if (b.tipo === "tabela") return b.linhas.length > 0 || b.cabecalho.length > 0;
    return b.itens.length > 0;
  });
}

function ehTelefone(coluna: string) {
  return /telefone|fone|contato/i.test(coluna);
}

/** Cada linha da tabela vira um cartão: no painel estreito do chat, uma tabela larga não cabe. */
function TabelaEmCartoes({ cabecalho, linhas, chave }: { cabecalho: string[]; linhas: string[][]; chave: string }) {
  if (linhas.length === 0) return <p>{inline(cabecalho.join(" · "), chave)}</p>;
  return (
    <div className="assistente-tabela">
      {linhas.map((linha, i) => (
        <div className="assistente-tabela-item" key={i}>
          <p className="assistente-tabela-titulo">{inline(linha[0] ?? "", `${chave}-${i}-t`)}</p>
          <dl>
            {cabecalho.slice(1).map((coluna, j) => {
              const valor = linha[j + 1];
              if (!valor || valor === "-" || valor === "—") return null;
              const digitos = valor.replace(/\D/g, "");
              return (
                <div key={j}>
                  <dt>{coluna.replace(/\*+$/, "")}</dt>
                  <dd>
                    {ehTelefone(coluna) && digitos.length >= 10 && digitos.length <= 11 ? (
                      <a href={`tel:+55${digitos}`}>{valor}</a>
                    ) : (
                      inline(valor, `${chave}-${i}-${j}`)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}

function TextoFormatado({ texto }: { texto: string }) {
  return (
    <>
      {blocos(texto).map((bloco, i) => {
        if (bloco.tipo === "p") {
          return (
            <p key={i}>
              {bloco.linhas.map((linha, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  {inline(linha, `${i}-${j}`)}
                </span>
              ))}
            </p>
          );
        }
        if (bloco.tipo === "tabela") {
          return <TabelaEmCartoes key={i} cabecalho={bloco.cabecalho} linhas={bloco.linhas} chave={String(i)} />;
        }
        const Lista = bloco.tipo;
        return (
          <Lista key={i}>
            {bloco.itens.map((item, j) => (
              <li key={j}>{inline(item, `${i}-${j}`)}</li>
            ))}
          </Lista>
        );
      })}
    </>
  );
}

export default TextoFormatado;
