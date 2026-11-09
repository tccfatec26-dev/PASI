import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import {
  criarPrismaMock,
  intermediario,
  paciente,
} from '../../test/helpers/dubles';
import { DocumentosService } from './documentos.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn() }));

describe('DocumentosService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: DocumentosService;

  const arquivo = {
    originalname: 'ficha.pdf',
    path: '/uploads/123.pdf',
  } as Express.Multer.File;
  const documento = (extra: Record<string, unknown> = {}) => ({
    id_documento: 1,
    id_formulario: 2,
    caminho: '/uploads/123.pdf',
    excluido: false,
    resposta: null,
    ...extra,
  });

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new DocumentosService(prisma);
    jest.mocked(existsSync).mockReturnValue(true);
    prisma.documentos.findUnique.mockResolvedValue(documento());
  });

  describe('registrarParaFormulario', () => {
    it('bloqueia paciente', async () => {
      await expect(
        service.registrarParaFormulario(2, arquivo, paciente),
      ).rejects.toThrow(ForbiddenException);
    });

    it('exige um arquivo', async () => {
      await expect(
        service.registrarParaFormulario(2, undefined, intermediario),
      ).rejects.toThrow(BadRequestException);
    });

    it('responde 404 para formulário inexistente', async () => {
      prisma.formulario.findUnique.mockResolvedValue(null);
      await expect(
        service.registrarParaFormulario(2, arquivo, intermediario),
      ).rejects.toThrow(NotFoundException);
    });

    it('registra o nome original, o caminho e o autor', async () => {
      prisma.formulario.findUnique.mockResolvedValue({ id_formulario: 2 });
      await service.registrarParaFormulario(2, arquivo, intermediario);
      expect(prisma.documentos.create.mock.calls[0][0].data).toMatchObject({
        nome_fisico: 'ficha.pdf',
        caminho: '/uploads/123.pdf',
        usuario: { connect: { id_usuario: intermediario.id_usuario } },
      });
    });
  });

  describe('listarPorFormulario', () => {
    it('profissional lista sem checagem de atribuição, omitindo os excluídos', async () => {
      await service.listarPorFormulario(2, intermediario);
      expect(prisma.atendimento_formulario.count).not.toHaveBeenCalled();
      expect(prisma.documentos.findMany.mock.calls[0][0].where).toEqual({
        id_formulario: 2,
        excluido: false,
      });
    });

    it('paciente lista documentos de formulário atribuído a ele', async () => {
      prisma.atendimento_formulario.count.mockResolvedValue(1);
      await service.listarPorFormulario(2, paciente);
      expect(prisma.atendimento_formulario.count).toHaveBeenCalledWith({
        where: {
          id_formulario: 2,
          atendimento: { id_usuario_paciente: paciente.id_usuario },
        },
      });
      expect(prisma.documentos.findMany).toHaveBeenCalled();
    });

    it('paciente não lista documentos de formulário não atribuído', async () => {
      prisma.atendimento_formulario.count.mockResolvedValue(0);
      await expect(service.listarPorFormulario(2, paciente)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.documentos.findMany).not.toHaveBeenCalled();
    });
  });

  describe('paraDownload', () => {
    it.each([
      ['inexistente', null],
      ['excluído', documento({ excluido: true })],
    ])('responde 404 para documento %s', async (_nome, doc) => {
      prisma.documentos.findUnique.mockResolvedValue(doc);
      await expect(service.paraDownload(1, intermediario)).rejects.toThrow(
        'Documento não encontrado',
      );
    });

    it('responde 404 quando o arquivo físico sumiu', async () => {
      jest.mocked(existsSync).mockReturnValue(false);
      await expect(service.paraDownload(1, intermediario)).rejects.toThrow(
        'Arquivo físico',
      );
    });

    it('profissional baixa qualquer documento', async () => {
      await expect(
        service.paraDownload(1, intermediario),
      ).resolves.toMatchObject({ id_documento: 1 });
    });

    it('paciente baixa o documento da própria resposta', async () => {
      prisma.documentos.findUnique.mockResolvedValue(
        documento({
          id_formulario: null,
          resposta: { id_usuario_pac: paciente.id_usuario },
        }),
      );
      await expect(service.paraDownload(1, paciente)).resolves.toBeDefined();
      expect(prisma.atendimento_formulario.count).not.toHaveBeenCalled();
    });

    it('paciente não baixa documento de resposta alheia sem formulário', async () => {
      prisma.documentos.findUnique.mockResolvedValue(
        documento({ id_formulario: null, resposta: { id_usuario_pac: 999 } }),
      );
      await expect(service.paraDownload(1, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('paciente baixa documento de formulário atribuído a ele', async () => {
      prisma.atendimento_formulario.count.mockResolvedValue(1);
      await expect(service.paraDownload(1, paciente)).resolves.toBeDefined();
    });

    it('paciente não baixa documento de formulário não atribuído', async () => {
      prisma.atendimento_formulario.count.mockResolvedValue(0);
      await expect(service.paraDownload(1, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remover', () => {
    it('bloqueia paciente', async () => {
      await expect(service.remover(1, paciente)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it.each([
      ['inexistente', null],
      ['já excluído', documento({ excluido: true })],
    ])('responde 404 para documento %s', async (_nome, doc) => {
      prisma.documentos.findUnique.mockResolvedValue(doc);
      await expect(service.remover(1, intermediario)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('faz exclusão lógica', async () => {
      await service.remover(1, intermediario);
      expect(prisma.documentos.update).toHaveBeenCalledWith({
        where: { id_documento: 1 },
        data: { excluido: true },
      });
    });
  });
});
