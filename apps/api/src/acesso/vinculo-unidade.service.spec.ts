import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { criarDuble, criarPrismaMock } from '../../test/helpers/dubles';
import { AcaoGestao } from '../common/constants';
import { VinculoUnidadeService } from './vinculo-unidade.service';

describe('VinculoUnidadeService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let log: ReturnType<typeof criarDuble>;
  let service: VinculoUnidadeService;

  const vinculo = (id: number, unidade: number, sede: boolean) => ({
    id_usuario_unidade: id,
    id_unidade_atendimento: unidade,
    sede,
    unidade_atendimento: { nome: `Unidade ${unidade}` },
  });

  beforeEach(() => {
    prisma = criarPrismaMock();
    log = criarDuble();
    service = new VinculoUnidadeService(prisma, log);
    prisma.usuario_unidade.findMany.mockResolvedValue([]);
  });

  describe('vincular', () => {
    beforeEach(() => {
      prisma.unidade_atendimento.findUnique.mockResolvedValue({
        nome: 'CRAS Centro',
      });
      prisma.usuario_unidade.findUnique.mockResolvedValue(null);
    });

    it('recusa unidade inexistente', async () => {
      prisma.unidade_atendimento.findUnique.mockResolvedValue(null);
      await expect(service.vincular(1, 2, false, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('recusa unidade já vinculada', async () => {
      prisma.usuario_unidade.findUnique.mockResolvedValue(vinculo(1, 2, false));
      await expect(service.vincular(1, 2, false, 9)).rejects.toThrow(
        ConflictException,
      );
    });

    it('cria vínculo comum sem alterar a sede atual', async () => {
      await service.vincular(1, 2, false, 9);
      expect(prisma.usuario_unidade.updateMany).not.toHaveBeenCalled();
      expect(prisma.usuario_unidade.create).toHaveBeenCalledWith({
        data: {
          id_usuario: 1,
          id_unidade_atendimento: 2,
          sede: false,
          id_usuario_vinculo: 9,
        },
      });
    });

    it('nova sede tira a marcação da sede anterior e registra o log', async () => {
      await service.vincular(1, 2, true, 9);
      expect(prisma.usuario_unidade.updateMany).toHaveBeenCalledWith({
        where: { id_usuario: 1, sede: true },
        data: { sede: false },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        {
          acao: AcaoGestao.VINCULAR_UNIDADE,
          idAutor: 9,
          idAlvo: 1,
          detalhe: 'CRAS Centro (nova sede)',
        },
        prisma,
      );
    });
  });

  describe('desvincular', () => {
    it('recusa unidade que não está vinculada', async () => {
      prisma.usuario_unidade.findMany.mockResolvedValue([vinculo(1, 1, true)]);
      await expect(service.desvincular(1, 2, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('mantém ao menos uma unidade vinculada', async () => {
      prisma.usuario_unidade.findMany.mockResolvedValue([vinculo(1, 1, false)]);
      await expect(service.desvincular(1, 1, 9)).rejects.toThrow(
        'pelo menos uma unidade',
      );
    });

    it('não desvincula a sede', async () => {
      prisma.usuario_unidade.findMany.mockResolvedValue([
        vinculo(1, 1, true),
        vinculo(2, 2, false),
      ]);
      await expect(service.desvincular(1, 1, 9)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.usuario_unidade.delete).not.toHaveBeenCalled();
    });

    it('remove o vínculo e registra o log', async () => {
      prisma.usuario_unidade.findMany.mockResolvedValue([
        vinculo(1, 1, true),
        vinculo(2, 2, false),
      ]);
      await service.desvincular(1, 2, 9);
      expect(prisma.usuario_unidade.delete).toHaveBeenCalledWith({
        where: { id_usuario_unidade: 2 },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: AcaoGestao.DESVINCULAR_UNIDADE,
          detalhe: 'Unidade 2',
        }),
        prisma,
      );
    });
  });

  describe('trocarSede', () => {
    it('recusa unidade que não está vinculada', async () => {
      prisma.usuario_unidade.findUnique.mockResolvedValue(null);
      await expect(service.trocarSede(1, 2, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não altera nada quando a unidade já é a sede', async () => {
      prisma.usuario_unidade.findUnique.mockResolvedValue(vinculo(1, 2, true));
      await service.trocarSede(1, 2, 9);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('troca a sede e registra o log', async () => {
      prisma.usuario_unidade.findUnique.mockResolvedValue(vinculo(5, 2, false));
      await service.trocarSede(1, 2, 9);
      expect(prisma.usuario_unidade.updateMany).toHaveBeenCalledWith({
        where: { id_usuario: 1, sede: true },
        data: { sede: false },
      });
      expect(prisma.usuario_unidade.update).toHaveBeenCalledWith({
        where: { id_usuario_unidade: 5 },
        data: { sede: true },
      });
      expect(log.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: AcaoGestao.TROCAR_SEDE }),
        prisma,
      );
    });
  });
});
