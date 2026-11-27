import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from './push.service';
import { SituacaoAtendimento, TipoNotificacao } from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';
import { QueryNotificacaoDto } from './dto/query-notificacao.dto';

/** ATD-2026-0042 (mesmo formato do painel e do app). */
function protocolo(id: number, dt: Date | null) {
  const ano = (dt ?? new Date()).getFullYear();
  return `ATD-${ano}-${String(id).padStart(4, '0')}`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const limitar = (texto: string, max: number) => (texto.length > max ? texto.slice(0, max - 1) + '…' : texto);

/** Campos devolvidos para o sino (painel e app). */
const CAMPOS = {
  id_notificacao: true,
  id_tipo_notificacao: true,
  titulo: true,
  mensagem: true,
  id_atendimento: true,
  id_formulario: true,
  lida: true,
  dt_leitura: true,
  dt_cadastro: true,
} satisfies Prisma.notificacaoSelect;

/**
 * Notificações do sino.
 *
 * Quem recebe o quê:
 * - paciente: quando é incluído em um atendimento (criação ou troca de
 *   paciente) e quando o atendimento dele ganha formulários novos;
 * - profissional: só quando o paciente conclui um formulário de um
 *   atendimento que ELE criou (atendimento.id_usuario_cad). Os outros
 *   profissionais não são avisados.
 *
 * Gravar um aviso nunca derruba a ação que o causou: se falhar (ex.: a tabela
 * ainda não foi criada no banco), o erro vai só para o log.
 *
 * E-mail: além do sino, vão por e-mail (Brevo, ver MailService) o aviso ao
 * paciente incluído em um atendimento e o aviso ao profissional de formulário
 * respondido. O envio não espera o Brevo (a resposta da ação sai na hora) e
 * uma falha fica só no log.
 *
 * Push: todo aviso gravado também vai como notificação push para os aparelhos
 * (app) de quem recebe, ver PushService. Também sem esperar e sem derrubar.
 */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  // ----------------------------------------------------------------
  // Leitura (o próprio usuário)
  // ----------------------------------------------------------------
  async listar(query: QueryNotificacaoDto, user: AuthUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.notificacaoWhereInput = {
      id_usuario: user.id_usuario,
      ...(query.nao_lidas ? { lida: false } : {}),
    };
    const [data, total, nao_lidas] = await this.prisma.$transaction([
      this.prisma.notificacao.findMany({
        where,
        orderBy: { id_notificacao: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPOS,
      }),
      this.prisma.notificacao.count({ where }),
      this.prisma.notificacao.count({ where: { id_usuario: user.id_usuario, lida: false } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit), nao_lidas };
  }

  async marcarLida(id: number, user: AuthUser) {
    const n = await this.prisma.notificacao.findUnique({
      where: { id_notificacao: id },
      select: { id_usuario: true, lida: true },
    });
    // a de outra pessoa é tratada como inexistente (não revela que existe)
    if (!n || n.id_usuario !== user.id_usuario) {
      throw new NotFoundException('Notificação não encontrada.');
    }
    if (!n.lida) {
      await this.prisma.notificacao.update({
        where: { id_notificacao: id },
        data: { lida: true, dt_leitura: new Date() },
      });
    }
    return { nao_lidas: await this.contarNaoLidas(user.id_usuario) };
  }

  async marcarTodasLidas(user: AuthUser) {
    await this.prisma.notificacao.updateMany({
      where: { id_usuario: user.id_usuario, lida: false },
      data: { lida: true, dt_leitura: new Date() },
    });
    return { nao_lidas: 0 };
  }

  private contarNaoLidas(idUsuario: number) {
    return this.prisma.notificacao.count({ where: { id_usuario: idUsuario, lida: false } });
  }

  // ----------------------------------------------------------------
  // Avisos gerados pelas ações (chamados pelos outros services)
  // ----------------------------------------------------------------

  /** Paciente incluído em um atendimento (criado agora ou com o paciente trocado). */
  async pacienteIncluido(idAtendimento: number, autor: AuthUser) {
    await this.semDerrubar('paciente incluído', async () => {
      const a = await this.prisma.atendimento.findUnique({
        where: { id_atendimento: idAtendimento },
        select: {
          id_usuario_paciente: true,
          dt_cadastro: true,
          _count: { select: { atendimento_formulario: true } },
        },
      });
      if (!a) return;
      const nomeAutor = await this.nomeDe(autor.id_usuario);
      const n = a._count.atendimento_formulario;
      const prot = protocolo(idAtendimento, a.dt_cadastro);
      const mensagem =
        `${nomeAutor} incluiu você no atendimento ${prot}.` +
        (n > 0 ? ` Você tem ${plural(n, 'formulário', 'formulários')} para responder.` : '');
      const gravou = await this.gravar({
        id_usuario: a.id_usuario_paciente,
        id_tipo_notificacao: TipoNotificacao.INCLUIDO_ATENDIMENTO,
        titulo: 'Novo atendimento',
        mensagem,
        id_atendimento: idAtendimento,
        id_usuario_origem: autor.id_usuario,
      });
      if (gravou) {
        this.emailSemEsperar('paciente incluído', a.id_usuario_paciente, (u) =>
          this.mail.enviarIncluidoAtendimento(u.email, u.nome, { protocolo: prot, profissional: nomeAutor, formularios: n }),
        );
      }
    });
  }

  /**
   * O paciente saiu do atendimento (troca de paciente): os avisos dele sobre
   * esse atendimento saem também, para não ficar um link que ele não abre mais.
   */
  async pacienteRemovido(idAtendimento: number, idPaciente: number) {
    await this.semDerrubar('paciente removido', () =>
      this.prisma.notificacao.deleteMany({
        where: {
          id_atendimento: idAtendimento,
          id_usuario: idPaciente,
          id_tipo_notificacao: { in: [TipoNotificacao.INCLUIDO_ATENDIMENTO, TipoNotificacao.NOVOS_FORMULARIOS] },
        },
      }),
    );
  }

  /** Formulários novos em um atendimento que já existia. */
  async formulariosAtribuidos(idAtendimento: number, idsFormularios: number[], autor: AuthUser) {
    if (idsFormularios.length === 0) return;
    await this.semDerrubar('formulários atribuídos', async () => {
      const [a, formularios] = await Promise.all([
        this.prisma.atendimento.findUnique({
          where: { id_atendimento: idAtendimento },
          select: { id_usuario_paciente: true, dt_cadastro: true },
        }),
        this.prisma.formulario.findMany({
          where: { id_formulario: { in: idsFormularios } },
          select: { id_formulario: true, nome: true },
        }),
      ]);
      if (!a) return;
      const n = idsFormularios.length;
      const nomes = formularios.map((f) => `“${f.nome ?? `Formulário ${f.id_formulario}`}”`).join(', ');
      const mensagem = limitar(
        `${n === 1 ? 'Há 1 novo formulário' : `Há ${n} novos formulários`} para responder ` +
          `no atendimento ${protocolo(idAtendimento, a.dt_cadastro)}: ${nomes}.`,
        300,
      );
      await this.gravar({
        id_usuario: a.id_usuario_paciente,
        id_tipo_notificacao: TipoNotificacao.NOVOS_FORMULARIOS,
        titulo: n === 1 ? 'Novo formulário' : 'Novos formulários',
        mensagem,
        id_atendimento: idAtendimento,
        // com um só formulário, o aviso abre direto nele
        id_formulario: n === 1 ? idsFormularios[0] : null,
        id_usuario_origem: autor.id_usuario,
      });
    });
  }

  /** O paciente concluiu um formulário: avisa SÓ quem criou o atendimento. */
  async formularioRespondido(idAtendimento: number, idFormulario: number, paciente: AuthUser) {
    await this.semDerrubar('formulário respondido', async () => {
      const [a, formulario, nomePaciente] = await Promise.all([
        this.prisma.atendimento.findUnique({
          where: { id_atendimento: idAtendimento },
          select: { id_usuario_cad: true, dt_cadastro: true, id_situacao_atendimento: true },
        }),
        this.prisma.formulario.findUnique({
          where: { id_formulario: idFormulario },
          select: { nome: true },
        }),
        this.nomeDe(paciente.id_usuario),
      ]);
      // atendimento antigo, sem quem criou: não há a quem avisar
      if (!a?.id_usuario_cad) return;
      const todos = a.id_situacao_atendimento === SituacaoAtendimento.RESPONDIDO;
      const prot = protocolo(idAtendimento, a.dt_cadastro);
      const nomeFormulario = formulario?.nome ?? 'formulário';
      const mensagem = limitar(
        `${nomePaciente} respondeu “${nomeFormulario}” no atendimento ${prot}.` +
          (todos ? ' Todos os formulários do atendimento foram respondidos.' : ''),
        300,
      );
      const idProfissional = a.id_usuario_cad;
      const gravou = await this.gravar({
        id_usuario: idProfissional,
        id_tipo_notificacao: TipoNotificacao.FORMULARIO_RESPONDIDO,
        titulo: 'Formulário respondido',
        mensagem,
        id_atendimento: idAtendimento,
        id_formulario: idFormulario,
        id_usuario_origem: paciente.id_usuario,
      });
      if (gravou) {
        this.emailSemEsperar('formulário respondido', idProfissional, (u) =>
          this.mail.enviarFormularioRespondido(u.email, u.nome, {
            paciente: nomePaciente,
            formulario: nomeFormulario,
            protocolo: prot,
            todos,
            idAtendimento,
            idFormulario,
          }),
        );
      }
    });
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  private async gravar(dados: {
    id_usuario: number;
    id_tipo_notificacao: number;
    titulo: string;
    mensagem: string;
    id_atendimento?: number | null;
    id_formulario?: number | null;
    id_usuario_origem: number;
  }) {
    // ninguém é avisado da própria ação
    if (dados.id_usuario === dados.id_usuario_origem) return false;
    const n = await this.prisma.notificacao.create({
      data: { ...dados, titulo: limitar(dados.titulo, 100), mensagem: limitar(dados.mensagem, 300) },
      select: { id_notificacao: true, titulo: true, mensagem: true },
    });
    // o mesmo aviso chega na barra do celular, mesmo com o app fechado
    this.push.enviarSemEsperar(dados.id_usuario, {
      titulo: n.titulo,
      mensagem: n.mensagem,
      dados: {
        id_notificacao: n.id_notificacao,
        id_tipo_notificacao: dados.id_tipo_notificacao,
        id_atendimento: dados.id_atendimento ?? null,
        id_formulario: dados.id_formulario ?? null,
      },
    });
    return true;
  }

  /**
   * Manda o e-mail do aviso sem segurar a resposta da ação (o Brevo pode levar
   * alguns segundos). Busca o e-mail do destinatário; sem e-mail, não envia.
   */
  private emailSemEsperar(
    oque: string,
    idUsuario: number,
    enviar: (u: { email: string; nome: string }) => Promise<boolean>,
  ) {
    void (async () => {
      const u = await this.prisma.usuario.findUnique({
        where: { id_usuario: idUsuario },
        select: { email: true, nome: true },
      });
      if (!u?.email) return;
      const ok = await enviar({ email: u.email, nome: u.nome ?? '' });
      if (!ok) this.logger.warn(`E-mail do aviso (${oque}) não enviado ao usuário ${idUsuario}.`);
    })().catch((e: unknown) =>
      this.logger.error(`Falha no e-mail do aviso (${oque})`, e instanceof Error ? e.stack : e),
    );
  }

  private async nomeDe(idUsuario: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
      select: { nome: true },
    });
    return u?.nome ?? 'Alguém';
  }

  private async semDerrubar(oque: string, acao: () => Promise<unknown>) {
    try {
      await acao();
    } catch (e) {
      this.logger.error(
        `Não foi possível gravar a notificação (${oque})`,
        e instanceof Error ? e.stack : e,
      );
    }
  }
}
