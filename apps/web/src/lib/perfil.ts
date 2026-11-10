import { TipoUsuario, type VinculoUnidade } from '../api/types';

export function nomePerfil(tipo?: number) {
  if (tipo === TipoUsuario.MAXIMO) return 'Máximo';
  if (tipo === TipoUsuario.INTERMEDIARIO) return 'Intermediário';
  return 'Paciente';
}

export const SEXOS = [
  { valor: 'F', rotulo: 'Feminino' },
  { valor: 'M', rotulo: 'Masculino' },
  { valor: 'O', rotulo: 'Outro' },
];

/** Sede primeiro, depois as demais na ordem de vínculo. */
export function ordenarUnidades(u: VinculoUnidade[] = []) {
  return [...u].sort((a, b) => Number(b.sede) - Number(a.sede));
}
