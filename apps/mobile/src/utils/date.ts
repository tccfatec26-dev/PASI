/**
 * Utilitários de data. Na interface as datas são digitadas/exibidas como
 * "dd/mm/aaaa"; na API trafegam em ISO.
 */

const doisDigitos = (n: number) => String(n).padStart(2, '0');

// Máscara progressiva dd/mm/aaaa a partir de qualquer texto digitado.
export function maskDataBr(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

// "dd/mm/aaaa" -> Date local. null se incompleta ou inexistente (ex.: 31/02).
export function brParaDate(br: string): Date | null {
  if (br.length !== 10) return null;
  const [d, m, y] = br.split('/').map(Number);
  if (!d || !m || !y) return null;
  const date = new Date(y, m - 1, d);
  // new Date "rola" datas inválidas (31/02 -> 03/03); confere se nada mudou.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

// "dd/mm/aaaa" -> "aaaa-mm-dd" (data sem horário). undefined se incompleta/inválida.
export function brParaIso(br: string): string | undefined {
  const date = brParaDate(br);
  if (!date) return undefined;
  return `${date.getFullYear()}-${doisDigitos(date.getMonth() + 1)}-${doisDigitos(date.getDate())}`;
}

// Date -> "dd/mm/aaaa"
export function dateParaBr(date: Date): string {
  return `${doisDigitos(date.getDate())}/${doisDigitos(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Data sem horário vinda da API (ex.: dt_nascimento, gravada à meia-noite UTC)
 * -> "dd/mm/aaaa". Lê em UTC para não voltar um dia em fusos negativos.
 */
export function isoParaBr(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Instante vindo da API (ex.: dt_cadastro) -> "dd/mm/aaaa" no fuso do aparelho. */
export function formatData(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : dateParaBr(d);
}

// Instante (ISO UTC) do INÍCIO do dia no fuso local. Para filtros de data:
// "12/06/2026" -> 2026-06-12T00:00:00 local convertido para UTC.
export function brParaIsoInicioDia(br: string): string | undefined {
  const d = brParaDate(br);
  if (!d) return undefined;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Instante (ISO UTC) do FIM do dia no fuso local (23:59:59.999).
export function brParaIsoFimDia(br: string): string | undefined {
  const d = brParaDate(br);
  if (!d) return undefined;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
