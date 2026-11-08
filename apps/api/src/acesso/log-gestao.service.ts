import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MODULO_GESTAO_USUARIOS } from '../common/constants';

type Cliente = PrismaService | Prisma.TransactionClient;

/**
 * Registra as ações da gestão de usuários em log_adm_geral (RN-USR-18),
 * com autor, usuário alvo, data e hora. Os ids de módulo e ação são
 * buscados pelo nome (carga do script SQL) e guardados em memória.
 */
@Injectable()
export class LogGestaoService {
  private idModulo: number | null = null;
  private readonly idsAcao = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async registrar(
    params: { acao: string; idAutor: number; idAlvo: number; detalhe?: string },
    cliente: Cliente = this.prisma,
  ) {
    const [id_modulo, id_acao] = await Promise.all([this.modulo(cliente), this.acao(params.acao, cliente)]);
    await cliente.log_adm_geral.create({
      data: {
        id_modulo,
        id_acao,
        id_usuario_acao: params.idAutor,
        id_usuario_alvo: params.idAlvo,
        detalhe: params.detalhe?.slice(0, 500),
      },
    });
  }

  private async modulo(cliente: Cliente): Promise<number> {
    if (this.idModulo !== null) return this.idModulo;
    const existente = await cliente.modulo.findFirst({ where: { nome: MODULO_GESTAO_USUARIOS } });
    const modulo =
      existente ?? (await cliente.modulo.create({ data: { nome: MODULO_GESTAO_USUARIOS } }));
    this.idModulo = modulo.id_modulo;
    return modulo.id_modulo;
  }

  private async acao(nome: string, cliente: Cliente): Promise<number> {
    const cache = this.idsAcao.get(nome);
    if (cache !== undefined) return cache;
    const existente = await cliente.acao.findFirst({ where: { nome } });
    const acao = existente ?? (await cliente.acao.create({ data: { nome } }));
    this.idsAcao.set(nome, acao.id_acao);
    return acao.id_acao;
  }
}
