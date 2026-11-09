import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TipoUsuario, ehProfissional } from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * Regras de visibilidade por perfil (RN-USR-20 a RN-USR-23):
 *   - paciente: só os próprios atendimentos;
 *   - intermediário: só atendimentos das unidades vinculadas a ele;
 *   - máximo: todos, de todas as unidades.
 */
@Injectable()
export class AcessoService {
  constructor(private readonly prisma: PrismaService) {}

  exigirProfissional(user: AuthUser) {
    if (!ehProfissional(user.tipo)) {
      throw new ForbiddenException('Apenas usuários profissionais podem executar esta ação.');
    }
  }

  exigirMaximo(user: AuthUser) {
    if (user.tipo !== TipoUsuario.MAXIMO) {
      throw new ForbiddenException('Apenas usuários de privilégio máximo podem executar esta ação.');
    }
  }

  async unidadesDoUsuario(idUsuario: number): Promise<number[]> {
    const rows = await this.prisma.usuario_unidade.findMany({
      where: { id_usuario: idUsuario },
      select: { id_unidade_atendimento: true },
    });
    return rows.map((r) => r.id_unidade_atendimento);
  }

  /** Filtro de atendimentos que o usuário pode ver. */
  async filtroAtendimentos(user: AuthUser): Promise<Prisma.atendimentoWhereInput> {
    if (user.tipo === TipoUsuario.PACIENTE) {
      return { id_usuario_paciente: user.id_usuario };
    }
    if (user.tipo === TipoUsuario.MAXIMO) {
      return {};
    }
    const unidades = await this.unidadesDoUsuario(user.id_usuario);
    return { id_unidade_atendimento: { in: unidades } };
  }

  /** Garante que o usuário pode abrir/alterar este atendimento. */
  async exigirAcessoAtendimento(
    user: AuthUser,
    atendimento: { id_usuario_paciente: number; id_unidade_atendimento: number | null },
  ) {
    if (user.tipo === TipoUsuario.PACIENTE) {
      if (atendimento.id_usuario_paciente !== user.id_usuario) {
        throw new ForbiddenException('Este atendimento não pertence a você.');
      }
      return;
    }
    if (user.tipo === TipoUsuario.MAXIMO) return;
    if (user.tipo === TipoUsuario.INTERMEDIARIO) {
      const unidades = await this.unidadesDoUsuario(user.id_usuario);
      if (atendimento.id_unidade_atendimento !== null && unidades.includes(atendimento.id_unidade_atendimento)) {
        return;
      }
      throw new ForbiddenException('Este atendimento é de uma unidade em que você não atende.');
    }
    throw new ForbiddenException('Acesso negado.');
  }

  /** Unidade escolhida ao criar/alterar atendimento: o intermediário só usa as dele. */
  async exigirUnidadePermitida(user: AuthUser, idUnidade: number) {
    if (user.tipo === TipoUsuario.MAXIMO) return;
    const unidades = await this.unidadesDoUsuario(user.id_usuario);
    if (!unidades.includes(idUnidade)) {
      throw new ForbiddenException('Você só pode usar as unidades de atendimento vinculadas a você.');
    }
  }
}
