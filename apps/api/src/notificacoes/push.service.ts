import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/current-user.decorator';

/** Serviço de push do Expo (entrega pelo FCM no Android). */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Máximo de mensagens por requisição aceito pelo Expo. */
const POR_LOTE = 100;
/**
 * Canal do Android criado pelo app (src/notificacoes/push.ts). Com outro id,
 * o Android não mostra a notificação.
 */
export const CANAL_ANDROID = 'notificacoes';

export interface PushParaEnviar {
  titulo: string;
  mensagem: string;
  /** vai para o app ao tocar na notificação (abrir a tela certa) */
  dados: Record<string, string | number | null>;
}

interface TicketExpo {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Notificações push no app do paciente.
 *
 * O app registra cada aparelho logado (token do Expo) e, quando a API grava
 * uma notificação do sino, este serviço manda o mesmo aviso para os aparelhos
 * de quem recebe: chega na barra do celular mesmo com o app fechado.
 *
 * O envio nunca atrasa nem derruba a ação que gerou o aviso: roda em segundo
 * plano e uma falha fica só no log. Token que o Expo diz não existir mais
 * (DeviceNotRegistered: app desinstalado, dados apagados) é removido.
 *
 * EXPO_ACCESS_TOKEN (opcional): só é preciso se a "segurança de push" for
 * ligada no projeto do Expo; sem ela, o serviço do Expo não pede autenticação.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ----------------------------------------------------------------
  // Aparelhos (o próprio usuário)
  // ----------------------------------------------------------------

  /**
   * Registra (ou atualiza) o aparelho do usuário logado. O mesmo aparelho
   * usado antes por outra conta passa para esta: cada aparelho avisa só quem
   * está logado nele.
   */
  async registrar(token: string, plataforma: string | undefined, user: AuthUser) {
    await this.prisma.dispositivo_push.upsert({
      where: { token },
      create: { token, plataforma: plataforma ?? null, id_usuario: user.id_usuario },
      update: { id_usuario: user.id_usuario, plataforma: plataforma ?? null, dt_atualizacao: new Date() },
    });
    return { registrado: true };
  }

  /** Saiu da conta no aparelho: ele para de receber os avisos dessa conta. */
  async remover(token: string, user: AuthUser) {
    await this.prisma.dispositivo_push.deleteMany({ where: { token, id_usuario: user.id_usuario } });
    return { removido: true };
  }

  // ----------------------------------------------------------------
  // Envio
  // ----------------------------------------------------------------

  /** Manda o push em segundo plano (não espera o Expo; falha vai para o log). */
  enviarSemEsperar(idUsuario: number, push: PushParaEnviar) {
    void this.enviar(idUsuario, push).catch((e: unknown) =>
      this.logger.error(`Falha ao enviar push ao usuário ${idUsuario}`, e instanceof Error ? e.stack : e),
    );
  }

  private async enviar(idUsuario: number, push: PushParaEnviar) {
    const aparelhos = await this.prisma.dispositivo_push.findMany({
      where: { id_usuario: idUsuario },
      select: { token: true },
    });
    if (aparelhos.length === 0) return;

    const tokens = aparelhos.map((a) => a.token);
    for (let i = 0; i < tokens.length; i += POR_LOTE) {
      const lote = tokens.slice(i, i + POR_LOTE);
      const mensagens = lote.map((to) => ({
        to,
        title: push.titulo,
        body: push.mensagem,
        data: push.dados,
        channelId: CANAL_ANDROID,
        priority: 'high',
        sound: 'default',
      }));
      const tickets = await this.postar(mensagens);
      if (!tickets) continue;
      // os tickets vêm na mesma ordem das mensagens
      const invalidos = lote.filter((_, k) => tickets[k]?.details?.error === 'DeviceNotRegistered');
      tickets
        .filter((t) => t.status === 'error' && t.details?.error !== 'DeviceNotRegistered')
        .forEach((t) => this.logger.warn(`Expo recusou o push: ${t.details?.error ?? ''} ${t.message ?? ''}`));
      if (invalidos.length) {
        await this.prisma.dispositivo_push.deleteMany({ where: { token: { in: invalidos } } });
        this.logger.log(`${invalidos.length} aparelho(s) sem o app removido(s) do push.`);
      }
    }
  }

  private async postar(mensagens: object[]): Promise<TicketExpo[] | null> {
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(mensagens),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => '');
      this.logger.error(`Expo respondeu ${resp.status} ao enviar push: ${corpo}`);
      return null;
    }
    const json = (await resp.json()) as { data?: TicketExpo[]; errors?: unknown[] };
    if (json.errors?.length) this.logger.error(`Expo devolveu erros no push: ${JSON.stringify(json.errors)}`);
    return Array.isArray(json.data) ? json.data : null;
  }
}
