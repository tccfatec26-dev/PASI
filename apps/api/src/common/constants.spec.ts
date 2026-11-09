import { SENHA_REGEX, TipoUsuario, ehProfissional } from './constants';

describe('constants', () => {
  describe('ehProfissional', () => {
    it.each([
      ['intermediário', TipoUsuario.INTERMEDIARIO, true],
      ['máximo', TipoUsuario.MAXIMO, true],
      ['paciente', TipoUsuario.PACIENTE, false],
      ['tipo desconhecido', 99, false],
    ])('classifica %s corretamente', (_nome, tipo, esperado) => {
      expect(ehProfissional(tipo)).toBe(esperado);
    });
  });

  describe('SENHA_REGEX (política de senha forte)', () => {
    it.each(['Senha@123', 'Abcdef1!', 'MinhaSenha@2026'])(
      'aceita a senha forte "%s"',
      (senha) => {
        expect(SENHA_REGEX.test(senha)).toBe(true);
      },
    );

    it.each([
      ['menos de 8 caracteres', 'Ab1!xyz'],
      ['sem letra maiúscula', 'senha@123'],
      ['sem letra minúscula', 'SENHA@123'],
      ['sem número', 'Senha@abc'],
      ['sem caractere especial', 'Senha1234'],
    ])('recusa senha %s', (_motivo, senha) => {
      expect(SENHA_REGEX.test(senha)).toBe(false);
    });
  });
});
