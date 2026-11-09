import { ForbiddenException } from '@nestjs/common';
import {
  criarPrismaMock,
  intermediario,
  maximo,
  paciente,
} from '../../test/helpers/dubles';
import type { AuthUser } from '../auth/current-user.decorator';
import { AcessoService } from './acesso.service';

describe('AcessoService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: AcessoService;

  const unidadesDoUsuario = (...ids: number[]) =>
    prisma.usuario_unidade.findMany.mockResolvedValue(
      ids.map((id_unidade_atendimento) => ({ id_unidade_atendimento })),
    );

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new AcessoService(prisma);
  });

  describe('exigirProfissional', () => {
    it.each([
      ['intermediário', intermediario],
      ['máximo', maximo],
    ])('permite %s', (_nome, user) => {
      expect(() => service.exigirProfissional(user)).not.toThrow();
    });

    it('bloqueia paciente', () => {
      expect(() => service.exigirProfissional(paciente)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('exigirMaximo', () => {
    it('permite máximo', () => {
      expect(() => service.exigirMaximo(maximo)).not.toThrow();
    });

    it.each([
      ['intermediário', intermediario],
      ['paciente', paciente],
    ])('bloqueia %s', (_nome, user) => {
      expect(() => service.exigirMaximo(user)).toThrow(ForbiddenException);
    });
  });

  describe('filtroAtendimentos', () => {
    it('restringe o paciente aos próprios atendimentos', async () => {
      await expect(service.filtroAtendimentos(paciente)).resolves.toEqual({
        id_usuario_paciente: paciente.id_usuario,
      });
    });

    it('não restringe o máximo', async () => {
      await expect(service.filtroAtendimentos(maximo)).resolves.toEqual({});
    });

    it('restringe o intermediário às unidades vinculadas', async () => {
      unidadesDoUsuario(1, 2);
      await expect(service.filtroAtendimentos(intermediario)).resolves.toEqual({
        id_unidade_atendimento: { in: [1, 2] },
      });
    });
  });

  describe('exigirAcessoAtendimento', () => {
    const atendimento = {
      id_usuario_paciente: paciente.id_usuario,
      id_unidade_atendimento: 1,
    };

    it('permite o paciente dono', async () => {
      await expect(
        service.exigirAcessoAtendimento(paciente, atendimento),
      ).resolves.toBeUndefined();
    });

    it('impede um paciente de abrir atendimento de outro paciente', async () => {
      const outro = { ...paciente, id_usuario: 11 };
      await expect(
        service.exigirAcessoAtendimento(outro, atendimento),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite o máximo em qualquer unidade', async () => {
      await expect(
        service.exigirAcessoAtendimento(maximo, atendimento),
      ).resolves.toBeUndefined();
      expect(prisma.usuario_unidade.findMany).not.toHaveBeenCalled();
    });

    it('permite o intermediário vinculado à unidade', async () => {
      unidadesDoUsuario(1);
      await expect(
        service.exigirAcessoAtendimento(intermediario, atendimento),
      ).resolves.toBeUndefined();
    });

    it('impede o intermediário de abrir atendimento de outra unidade', async () => {
      unidadesDoUsuario(2);
      await expect(
        service.exigirAcessoAtendimento(intermediario, atendimento),
      ).rejects.toThrow('unidade em que você não atende');
    });

    it('impede o intermediário de abrir atendimento sem unidade', async () => {
      unidadesDoUsuario(1);
      await expect(
        service.exigirAcessoAtendimento(intermediario, {
          ...atendimento,
          id_unidade_atendimento: null,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('nega acesso a um tipo de usuário desconhecido', async () => {
      const desconhecido: AuthUser = { ...maximo, tipo: 99 };
      await expect(
        service.exigirAcessoAtendimento(desconhecido, atendimento),
      ).rejects.toThrow('Acesso negado.');
    });
  });

  describe('exigirUnidadePermitida', () => {
    it('permite qualquer unidade ao máximo', async () => {
      await expect(
        service.exigirUnidadePermitida(maximo, 99),
      ).resolves.toBeUndefined();
    });

    it('permite ao intermediário uma unidade vinculada', async () => {
      unidadesDoUsuario(5);
      await expect(
        service.exigirUnidadePermitida(intermediario, 5),
      ).resolves.toBeUndefined();
    });

    it('impede o intermediário de usar unidade não vinculada', async () => {
      unidadesDoUsuario(5);
      await expect(
        service.exigirUnidadePermitida(intermediario, 6),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
