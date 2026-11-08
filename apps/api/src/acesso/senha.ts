import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { SENHA_PROVISORIA_HORAS } from '../common/constants';

export const SALT_ROUNDS = 10;

const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const ESPECIAIS = '@#$%&*!?';

/**
 * Senha provisória aleatória (RN-USR-07), já no padrão de senha forte:
 * 12 caracteres com maiúscula, minúscula, número e especial. Evita
 * caracteres ambíguos (0/O, 1/l/I) porque o profissional vai digitá-la.
 */
export function gerarSenhaProvisoria(tamanho = 12): string {
  const todos = MAIUSCULAS + MINUSCULAS + NUMEROS + ESPECIAIS;
  const escolher = (conj: string) => conj[randomInt(conj.length)];
  const chars = [escolher(MAIUSCULAS), escolher(MINUSCULAS), escolher(NUMEROS), escolher(ESPECIAIS)];
  while (chars.length < tamanho) chars.push(escolher(todos));
  // Embaralha (Fisher-Yates) para a posição dos obrigatórios não ser previsível.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function expiracaoSenhaProvisoria(agora = new Date()): Date {
  return new Date(agora.getTime() + SENHA_PROVISORIA_HORAS * 60 * 60 * 1000);
}

export function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

export function conferirSenha(senha: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(senha, hash);
}
