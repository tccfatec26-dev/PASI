/** "2026-10-20" (input date) → início do dia no fuso local, em ISO. */
export function inicioDoDia(d: string) {
  return d ? new Date(`${d}T00:00:00`).toISOString() : undefined;
}
/** "2026-10-20" → fim do dia no fuso local, em ISO. */
export function fimDoDia(d: string) {
  return d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined;
}
