/** Utilitários de exibição usados em várias telas. */

export const soDigitos = (v: string) => (v ?? '').replace(/\D/g, '');

/** 12345678901 → 123.456.789-01 */
export function cpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** CPF mascarado como no protótipo: 123.***.***-01 */
export function cpfMascarado(v: string) {
  const d = soDigitos(v);
  if (d.length !== 11) return cpf(v);
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

/** 11999998888 → (11) 99999-8888 */
export function telefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function data(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function dataHora(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** "Maria Souza" → "MS" */
export function iniciais(nome?: string | null) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function primeiroNome(nome?: string | null) {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

/** ATD-2026-0042 */
export function protocolo(id: number, dt?: string | null) {
  const ano = dt ? new Date(dt).getFullYear() : new Date().getFullYear();
  return `ATD-${ano}-${String(id).padStart(4, '0')}`;
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
