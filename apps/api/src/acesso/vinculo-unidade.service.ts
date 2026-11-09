import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcaoGestao } from '../common/constants';
import { LogGestaoService } from './log-gestao.service';

/**
 * Unidades de atendimento de um profissional (RN-USR-15 a RN-USR-17):
 *   - sempre fica pelo menos uma unidade;
 *   - sempre há exatamente uma sede;
 *   - para desvincular a sede, outra precisa virar sede antes.
 * Usado pela gestão (máximo sobre intermediário) e pelo Meu perfil do máximo.
 */
@Injectable()
export class VinculoUnidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: LogGestaoService,
  ) {}

  listar(idUsuario: number) {
    return this.prisma.usuario_unidade.findMany({
      where: { id_usuario: idUsuario },
      orderBy: [{ sede: 'desc' }, { dt_vinculo: 'asc' }],
      include: {
        unidade_atendimento: {
          select: {
            id_unidade_atendimento: true,
            nome: true,
            tipo_unidade_atendimento: { select: { id_tipo_unidade_atend: true, nome: true } },
          },
        },
        usuario_vinculo: { select: { id_usuario: true, nome: true } },
      },
    });
  }

  async vincular(idUsuario: number, idUnidade: number, sede: boolean, idAutor: number) {
    const unidade = await this.prisma.unidade_atendimento.findUnique({
      where: { id_unidade_atendimento: idUnidade },
      select: { nome: true },
    });
    if (!unidade) throw new NotFoundException('Unidade de atendimento não encontrada.');

    const jaTem = await this.prisma.usuario_unidade.findUnique({
      where: { id_usuario_id_unidade_atendimento: { id_usuario: idUsuario, id_unidade_atendimento: idUnidade } },
    });
    if (jaTem) throw new ConflictException('Esta unidade já está vinculada ao profissional.');

    await this.prisma.$transaction(async (tx) => {
      if (sede) {
        await tx.usuario_unidade.updateMany({ where: { id_usuario: idUsuario, sede: true }, data: { sede: false } });
      }
      await tx.usuario_unidade.create({
        data: { id_usuario: idUsuario, id_unidade_atendimento: idUnidade, sede, id_usuario_vinculo: idAutor },
      });
      await this.log.registrar(
        { acao: AcaoGestao.VINCULAR_UNIDADE, idAutor, idAlvo: idUsuario, detalhe: unidade.nome + (sede ? ' (nova sede)' : '') },
        tx,
      );
    });
    return this.listar(idUsuario);
  }

  async desvincular(idUsuario: number, idUnidade: number, idAutor: number) {
    const vinculos = await this.prisma.usuario_unidade.findMany({
      where: { id_usuario: idUsuario },
      include: { unidade_atendimento: { select: { nome: true } } },
    });
    const alvo = vinculos.find((v) => v.id_unidade_atendimento === idUnidade);
    if (!alvo) throw new NotFoundException('Esta unidade não está vinculada ao profissional.');
    if (vinculos.length <= 1) {
      throw new BadRequestException('O profissional precisa ficar com pelo menos uma unidade.');
    }
    if (alvo.sede) {
      throw new BadRequestException('Para desvincular a sede, marque outra unidade como sede antes.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario_unidade.delete({ where: { id_usuario_unidade: alvo.id_usuario_unidade } });
      await this.log.registrar(
        { acao: AcaoGestao.DESVINCULAR_UNIDADE, idAutor, idAlvo: idUsuario, detalhe: alvo.unidade_atendimento.nome },
        tx,
      );
    });
    return this.listar(idUsuario);
  }

  async trocarSede(idUsuario: number, idUnidade: number, idAutor: number) {
    const alvo = await this.prisma.usuario_unidade.findUnique({
      where: { id_usuario_id_unidade_atendimento: { id_usuario: idUsuario, id_unidade_atendimento: idUnidade } },
      include: { unidade_atendimento: { select: { nome: true } } },
    });
    if (!alvo) throw new NotFoundException('Esta unidade não está vinculada ao profissional.');
    if (alvo.sede) return this.listar(idUsuario);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario_unidade.updateMany({ where: { id_usuario: idUsuario, sede: true }, data: { sede: false } });
      await tx.usuario_unidade.update({ where: { id_usuario_unidade: alvo.id_usuario_unidade }, data: { sede: true } });
      await this.log.registrar(
        { acao: AcaoGestao.TROCAR_SEDE, idAutor, idAlvo: idUsuario, detalhe: alvo.unidade_atendimento.nome },
        tx,
      );
    });
    return this.listar(idUsuario);
  }
}
