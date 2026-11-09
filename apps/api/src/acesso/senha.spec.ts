import { SENHA_PROVISORIA_HORAS, SENHA_REGEX } from '../common/constants';
import {
  conferirSenha,
  expiracaoSenhaProvisoria,
  gerarSenhaProvisoria,
  hashSenha,
} from './senha';

describe('senha', () => {
  describe('gerarSenhaProvisoria', () => {
    it('gera 12 caracteres por padrão', () => {
      expect(gerarSenhaProvisoria()).toHaveLength(12);
    });

    it('respeita o tamanho informado', () => {
      expect(gerarSenhaProvisoria(20)).toHaveLength(20);
    });

    it('sempre atende à política de senha forte (500 amostras)', () => {
      for (let i = 0; i < 500; i++) {
        expect(gerarSenhaProvisoria()).toMatch(SENHA_REGEX);
      }
    });

    it('não usa caracteres ambíguos para digitação (500 amostras)', () => {
      for (let i = 0; i < 500; i++) {
        expect(gerarSenhaProvisoria()).not.toMatch(/[0O1lI]/);
      }
    });

    it('gera valores diferentes a cada chamada', () => {
      const amostras = new Set(
        Array.from({ length: 100 }, () => gerarSenhaProvisoria()),
      );
      expect(amostras.size).toBe(100);
    });
  });

  describe('expiracaoSenhaProvisoria', () => {
    it('vence 24 horas depois da data informada', () => {
      const agora = new Date('2026-11-09T12:00:00.000Z');
      expect(SENHA_PROVISORIA_HORAS).toBe(24);
      expect(expiracaoSenhaProvisoria(agora)).toEqual(
        new Date('2026-11-10T12:00:00.000Z'),
      );
    });
  });

  describe('hashSenha e conferirSenha', () => {
    it('não guarda a senha em texto puro', async () => {
      const hash = await hashSenha('Senha@123');
      expect(hash).not.toContain('Senha@123');
      expect(hash).toMatch(/^\$2[aby]\$10\$/);
    });

    it('confere a senha correta', async () => {
      const hash = await hashSenha('Senha@123');
      await expect(conferirSenha('Senha@123', hash)).resolves.toBe(true);
    });

    it('recusa a senha incorreta', async () => {
      const hash = await hashSenha('Senha@123');
      await expect(conferirSenha('Senha@124', hash)).resolves.toBe(false);
    });

    it.each([null, undefined, ''])(
      'recusa quando o hash é %p',
      async (hash) => {
        await expect(conferirSenha('Senha@123', hash)).resolves.toBe(false);
      },
    );
  });
});
