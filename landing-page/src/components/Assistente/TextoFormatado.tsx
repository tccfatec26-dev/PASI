import type { ReactNode } from "react";

// A API responde em markdown simples (negrito, itálico, listas e links).
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

type Bloco = { tipo: "p"; linhas: string[] } | { tipo: "ul" | "ol"; itens: string[] };

function blocos(texto: string): Bloco[] {
  const resultado: Bloco[] = [];
  for (const bruta of texto.replace(/\r/g, "").split("\n")) {
    const linha = bruta.trim();
    const ultimo = resultado[resultado.length - 1];
    if (!linha) {
      resultado.push({ tipo: "p", linhas: [] });
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
  return resultado.filter((b) => (b.tipo === "p" ? b.linhas.length > 0 : b.itens.length > 0));
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
