import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SituacaoAtendimento, SituacaoFormulario } from '../common/constants';
import { AcessoService } from '../acesso/acesso.service';
import type { AuthUser } from '../auth/current-user.decorator';
import { recalcularSituacaoAtendimento } from '../common/situacao-atendimento';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';

@Injectable()
export class AvaliacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  // ----------------------------------------------------------------
  // Iniciar a análise de um formulário respondido (profissional).
  // Move o formulario_paciente de "Respondido" para "Em avaliação" e
  // recalcula o atendimento (vai para "Em avaliação"). Idempotente: se já
  // está em avaliação, apenas retorna; se já foi avaliado, bloqueia.
  // ----------------------------------------------------------------
  async iniciar(idAtendimento: number, idFormulario: number, user: AuthUser) {
    this.somenteProfissional(user);
    const atendimento = await this.acharAtendimento(idAtendimento, user);
    this.garantirFormularioAtribuido(atendimento, idFormulario);
    this.garantirAtendimentoAvaliavel(atendimento.id_situacao_atendimento);

    const fp = await this.exigirFormularioPaciente(idAtendimento, idFormulario);

    if (fp.id_situacao_formulario === SituacaoFormulario.AVALIADO) {
      throw new BadRequestException(
        'Este formulário já foi avaliado e não pode ser avaliado novamente.',
      );
    }

    if (fp.id_situacao_formulario === SituacaoFormulario.RESPONDIDO) {
      await this.prisma.formulario_paciente.update({
        where: { id_formulario_paciente: fp.id_formulario_paciente },
        data: {
          situacao_formulario: {
            connect: { id_situacao_formulario: SituacaoFormulario.EM_AVALIACAO },
          },
        },
      });
    } else if (fp.id_situacao_formulario !== SituacaoFormulario.EM_AVALIACAO) {
      throw new BadRequestException(
        'Só é possível avaliar formulários que já foram respondidos pelo paciente.',
      );
    }

    // O atendimento entra em "Em avaliação" assim que a análise começa.
    await recalcularSituacaoAtendimento(this.prisma, idAtendimento);

    return this.listar(idAtendimento, idFormulario, user);
  }

  // ----------------------------------------------------------------
  // Avaliar (finalizar) um formulário respondido (profissional). Registra
  // a observação ligada ao formulário DESTE paciente neste atendimento,
  // marca o formulario_paciente como "Avaliado" (impedindo novas
  // avaliações) e recalcula o atendimento: "Avaliado" quando todos os
  // formulários atribuídos estiverem avaliados, senão "Em avaliação".
  // ----------------------------------------------------------------
  async avaliar(
    idAtendimento: number,
    idFormulario: number,
    dto: CreateAvaliacaoDto,
    user: AuthUser,
  ) {
    this.somenteProfissional(user);
    const atendimento = await this.acharAtendimento(idAtendimento, user);
    this.garantirFormularioAtribuido(atendimento, idFormulario);
    this.garantirAtendimentoAvaliavel(atendimento.id_situacao_atendimento);

    const fp = await this.exigirFormularioPaciente(idAtendimento, idFormulario);

    // Só uma avaliação por formulário: depois de "Avaliado", não permite mais.
    if (fp.id_situacao_formulario === SituacaoFormulario.AVALIADO) {
      throw new BadRequestException(
        'Este formulário já foi avaliado e não pode ser avaliado novamente.',
      );
    }
    const avaliavel: number[] = [
      SituacaoFormulario.RESPONDIDO,
      SituacaoFormulario.EM_AVALIACAO,
    ];
    if (!avaliavel.includes(fp.id_situacao_formulario)) {
      throw new BadRequestException(
        'Só é possível avaliar formulários que já foram respondidos pelo paciente.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.formulario_avaliacao.create({
        data: {
          formulario: { connect: { id_formulario: idFormulario } },
          formulario_paciente: {
            connect: { id_formulario_paciente: fp.id_formulario_paciente },
          },
          usuario: { connect: { id_usuario: user.id_usuario } },
          observacao: dto.observacao,
        },
      }),
      this.prisma.formulario_paciente.update({
        where: { id_formulario_paciente: fp.id_formulario_paciente },
        data: {
          situacao_formulario: {
            connect: { id_situacao_formulario: SituacaoFormulario.AVALIADO },
          },
        },
      }),
    ]);

    await recalcularSituacaoAtendimento(this.prisma, idAtendimento);

    return this.listar(idAtendimento, idFormulario, user);
  }

  // ----------------------------------------------------------------
  // Lista as avaliações do formulário do paciente NESTE atendimento.
  // ----------------------------------------------------------------
  async listar(idAtendimento: number, idFormulario: number, user: AuthUser) {
    this.somenteProfissional(user);
    const atendimento = await this.acharAtendimento(idAtendimento, user);
    this.garantirFormularioAtribuido(atendimento, idFormulario);

    const fp = await this.acharFormularioPaciente(idAtendimento, idFormulario);
    if (!fp) return [];

    return this.prisma.formulario_avaliacao.findMany({
      where: { id_formulario_paciente: fp.id_formulario_paciente },
      orderBy: { id_formulario_avaliacao: 'desc' },
      include: {
        usuario: { select: { id_usuario: true, nome: true } },
      },
    });
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  private garantirAtendimentoAvaliavel(idSituacaoAtendimento: number) {
    const bloqueado: number[] = [
      SituacaoAtendimento.ENCERRADO,
      SituacaoAtendimento.INATIVO,
    ];
    if (bloqueado.includes(idSituacaoAtendimento)) {
      throw new BadRequestException(
        'Não é possível avaliar um atendimento Encerrado ou Inativo.',
      );
    }
  }

  // O formulario_paciente é do atendimento (não só do formulário + paciente).
  private acharFormularioPaciente(idAtendimento: number, idFormulario: number) {
    return this.prisma.formulario_paciente.findFirst({
      where: { id_atendimento: idAtendimento, id_formulario: idFormulario },
    });
  }

  private async exigirFormularioPaciente(idAtendimento: number, idFormulario: number) {
    const fp = await this.acharFormularioPaciente(idAtendimento, idFormulario);
    if (!fp) {
      throw new BadRequestException(
        'O paciente ainda não respondeu este formulário.',
      );
    }
    return fp;
  }

  // Também aplica a visibilidade por unidade (RN-USR-22 e 23).
  private async acharAtendimento(idAtendimento: number, user: AuthUser) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id_atendimento: idAtendimento },
      include: {
        atendimento_formulario: { select: { id_formulario: true } },
      },
    });
    if (!atendimento) {
      throw new NotFoundException('Atendimento não encontrado');
    }
    await this.acesso.exigirAcessoAtendimento(user, atendimento);
    return atendimento;
  }

  private garantirFormularioAtribuido(
    atendimento: { atendimento_formulario: { id_formulario: number }[] },
    idFormulario: number,
  ) {
    const atribuido = atendimento.atendimento_formulario.some(
      (af) => af.id_formulario === idFormulario,
    );
    if (!atribuido) {
      throw new BadRequestException(
        'Este formulário não está atribuído a este atendimento.',
      );
    }
  }

  private somenteProfissional(user: AuthUser) {
    this.acesso.exigirProfissional(user);
  }
}
