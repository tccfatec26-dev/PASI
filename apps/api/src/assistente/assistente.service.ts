import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { TipoUsuario } from '../common/constants';
import type { AuthUser } from '../auth/current-user.decorator';
import { PedidoAtendenteDto } from './dto/pedido-atendente.dto';

/** ATD-2026-0042 (mesmo formato do painel e do app). */
function protocolo(id: number, dt: Date | null) {
  const ano = (dt ?? new Date()).getFullYear();
  return `ATD-${ano}-${String(id).padStart(4, '0')}`;
}

/** (11) 98765-4321 */
function formatarTelefone(tel: string | null | undefined) {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel ?? '';
}

/** Um pedido por atendimento a cada 10 minutos, para um toque repetido não lotar a caixa da unidade. */
const INTERVALO_MS = 10 * 60 * 1000;

/**
 * Assistente virtual do app do paciente.
 *
 * Pedido de atendente: quando o paciente quer falar com uma pessoa
 * (recepção ou profissional), a API
 *  1. manda um e-mail para a unidade do atendimento, com o resumo da conversa
 *     e o "Responder" apontando para o e-mail do paciente;
 *  2. grava um aviso no sino (e push) para o profissional que criou o
 *     atendimento.
 * Cada parte pode falhar sozinha; a resposta diz o que deu certo, e o app
 * mostra o telefone da unidade como alternativa.
 */
@Injectable()
export class AssistenteService {
  private readonly logger = new Logger(AssistenteService.name);
  /** id_usuario:id_atendimento -> horário do último pedido (memória do processo) */
  private readonly ultimos = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async pedirAtendente(dto: PedidoAtendenteDto, user: AuthUser) {
    if (user.tipo !== TipoUsuario.PACIENTE) {
      throw new ForbiddenException('O pedido de atendente é feito pelo paciente, no aplicativo.');
    }

    const a = await this.prisma.atendimento.findUnique({
      where: { id_atendimento: dto.id_atendimento },
      select: {
        id_atendimento: true,
        descricao: true,
        dt_cadastro: true,
        id_usuario_paciente: true,
        id_usuario_cad: true,
        unidade_atendimento: { select: { nome: true, email: true, telefone: true } },
      },
    });
    // o de outra pessoa é tratado como inexistente (não revela que existe)
    if (!a || a.id_usuario_paciente !== user.id_usuario) {
      throw new NotFoundException('Atendimento não encontrado.');
    }

    const chave = `${user.id_usuario}:${a.id_atendimento}`;
    const ultimo = this.ultimos.get(chave);
    if (ultimo && Date.now() - ultimo < INTERVALO_MS) {
      throw new HttpException(
        'Você já pediu um atendente para este atendimento há pouco. Aguarde o contato da unidade.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const paciente = await this.prisma.usuario.findUnique({
      where: { id_usuario: user.id_usuario },
      select: { nome: true, email: true, tel_celular: true },
    });
    if (!paciente) throw new NotFoundException('Usuário não encontrado.');

    const unidade = a.unidade_atendimento;
    const assunto = dto.assunto.trim();
    const mensagem = dto.mensagem?.trim() || null;

    const [emailEnviado, profissionalAvisado] = await Promise.all([
      unidade?.email
        ? this.mail
            .enviarPedidoAtendente(unidade.email, unidade.nome, {
              paciente: {
                nome: paciente.nome,
                email: paciente.email,
                celular: formatarTelefone(paciente.tel_celular),
              },
              protocolo: protocolo(a.id_atendimento, a.dt_cadastro),
              descricao: a.descricao,
              assunto,
              mensagem,
              conversa: dto.conversa ?? [],
              idAtendimento: a.id_atendimento,
            })
            .catch((e: unknown) => {
              this.logger.error('Falha no e-mail do pedido de atendente', e instanceof Error ? e.stack : e);
              return false;
            })
        : Promise.resolve(false),
      this.notificacoes.pedidoAtendente(a, assunto, user),
    ]);

    if (!unidade?.email) {
      this.logger.warn(
        `Pedido de atendente no atendimento ${a.id_atendimento}: unidade sem e-mail cadastrado.`,
      );
    }
    if (emailEnviado || profissionalAvisado) this.ultimos.set(chave, Date.now());

    return {
      enviado: emailEnviado || profissionalAvisado,
      email_unidade: emailEnviado,
      profissional_avisado: profissionalAvisado,
      unidade: unidade ? { nome: unidade.nome, telefone: unidade.telefone } : null,
    };
  }
}
