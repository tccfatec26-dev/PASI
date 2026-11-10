/** Mesma regra da API (SENHA_REGEX): 8+ caracteres, maiúscula, minúscula, número e especial. */
export function criteriosSenha(nova: string, diferenteDe?: { valor: string; rotulo: string }) {
  const lista: [string, boolean][] = [
    ['Mínimo de 8 caracteres', nova.length >= 8],
    ['Uma letra maiúscula', /[A-Z]/.test(nova)],
    ['Uma letra minúscula', /[a-z]/.test(nova)],
    ['Um número', /[0-9]/.test(nova)],
    ['Um caractere especial', /[^A-Za-z0-9]/.test(nova)],
  ];
  if (diferenteDe) lista.push([diferenteDe.rotulo, nova.length > 0 && nova !== diferenteDe.valor]);
  return lista;
}

export const senhaForte = (s: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(s);
