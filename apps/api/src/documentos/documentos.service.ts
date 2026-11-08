import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { ehProfissional } from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class DocumentosService {
  constructor(private readonly prisma: PrismaService) {}

  // Registra um arquivo de apoio para um formulário (profissional).
  async registrarParaFormulario(
    idFormulario: number,
    file: Express.Multer.File | undefined,
    user: AuthUser,
  ) {
    this.somenteProfissional(user);
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    const formulario = await this.prisma.formulario.findUnique({
      where: { id_formulario: idFormulario },
    });
    if (!formulario) {
      throw new NotFoundException('Formulário não encontrado');
    }

    return this.prisma.documentos.create({
      data: {
        formulario: { connect: { id_formulario: idFormulario } },
        nome_fisico: file.originalname,
        caminho: file.path,
        usuario: { connect: { id_usuario: user.id_usuario } },
      },
    });
  }

  // Profissional vê os documentos de qualquer formulário; o paciente, só
  // os de formulários atribuídos a algum atendimento dele.
  async listarPorFormulario(idFormulario: number, user: AuthUser) {
    await this.garantirAcessoAoFormulario(idFormulario, user);
    return this.prisma.documentos.findMany({
      where: { id_formulario: idFormulario, excluido: false },
      orderBy: { id_documento: 'desc' },
    });
  }

  // Retorna o documento validando que ainda existe (lógica e fisicamente)
  // e que o usuário pode vê-lo.
  async paraDownload(idDocumento: number, user: AuthUser) {
    const doc = await this.prisma.documentos.findUnique({
      where: { id_documento: idDocumento },
      include: { resposta: { select: { id_usuario_pac: true } } },
    });
    if (!doc || doc.excluido) {
      throw new NotFoundException('Documento não encontrado');
    }
    if (!ehProfissional(user.tipo)) {
      const respostaDoPaciente = doc.resposta?.id_usuario_pac === user.id_usuario;
      if (!respostaDoPaciente) {
        if (doc.id_formulario === null) {
          throw new ForbiddenException('Você não tem acesso a este documento.');
        }
        await this.garantirAcessoAoFormulario(doc.id_formulario, user);
      }
    }
    if (!existsSync(doc.caminho)) {
      throw new NotFoundException('Arquivo físico não encontrado no servidor.');
    }
    return doc;
  }

  // Exclusão lógica (mantém o registro com excluido = true).
  async remover(idDocumento: number, user: AuthUser) {
    this.somenteProfissional(user);
    const doc = await this.prisma.documentos.findUnique({
      where: { id_documento: idDocumento },
    });
    if (!doc || doc.excluido) {
      throw new NotFoundException('Documento não encontrado');
    }
    return this.prisma.documentos.update({
      where: { id_documento: idDocumento },
      data: { excluido: true },
    });
  }

  private async garantirAcessoAoFormulario(idFormulario: number, user: AuthUser) {
    if (ehProfissional(user.tipo)) return;
    const atribuido = await this.prisma.atendimento_formulario.count({
      where: {
        id_formulario: idFormulario,
        atendimento: { id_usuario_paciente: user.id_usuario },
      },
    });
    if (atribuido === 0) {
      throw new ForbiddenException('Você não tem acesso a este documento.');
    }
  }

  private somenteProfissional(user: AuthUser) {
    if (!ehProfissional(user.tipo)) {
      throw new ForbiddenException(
        'Apenas usuários profissionais podem gerenciar documentos.',
      );
    }
  }
}
