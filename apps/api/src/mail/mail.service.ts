import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailParaEnviar {
  para: string;
  nome?: string;
  assunto: string;
  html: string;
  texto: string;
}

/**
 * Envio de e-mails pela API HTTPS do Brevo (o plano gratuito do Render
 * bloqueia SMTP). Variáveis de ambiente:
 *   BREVO_API_KEY    chave da API do Brevo
 *   MAIL_FROM_EMAIL  remetente validado no Brevo (ex.: pasi.contato@...)
 *   MAIL_FROM_NAME   nome exibido (padrão "PASI")
 * Sem BREVO_API_KEY (desenvolvimento), o e-mail só é registrado no log.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /** Envia o e-mail. Devolve false se não conseguiu (o chamador decide o que fazer). */
  async enviar(email: EmailParaEnviar): Promise<boolean> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const fromEmail = this.config.get<string>('MAIL_FROM_EMAIL');
    const fromName = this.config.get<string>('MAIL_FROM_NAME') ?? 'PASI';

    if (!apiKey || !fromEmail) {
      this.logger.warn(
        `[e-mail não enviado: BREVO_API_KEY/MAIL_FROM_EMAIL ausentes] para=${email.para} assunto="${email.assunto}"\n${email.texto}`,
      );
      return false;
    }

    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: fromEmail, name: fromName },
          to: [{ email: email.para, ...(email.nome ? { name: email.nome } : {}) }],
          subject: email.assunto,
          htmlContent: email.html,
          textContent: email.texto,
        }),
      });
      if (!resp.ok) {
        const corpo = await resp.text().catch(() => '');
        this.logger.error(`Brevo respondeu ${resp.status} ao enviar para ${email.para}: ${corpo}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Falha ao enviar e-mail para ${email.para}: ${(e as Error).message}`);
      return false;
    }
  }

  /** Senha provisória do cadastro ou do reenvio (RN-USR-07 / RN-USR-19). */
  enviarSenhaProvisoria(para: string, nome: string, senha: string, expiraEm: Date) {
    const link = this.urlPainel();
    const validade = this.formatarDataHora(expiraEm);
    const primeiroNome = nome.split(' ')[0];
    return this.enviar({
      para,
      nome,
      assunto: 'PASI — sua senha provisória de acesso',
      texto:
        `Olá, ${primeiroNome}!\n\n` +
        `Seu cadastro no painel do profissional do PASI foi criado.\n` +
        `Senha provisória: ${senha}\n` +
        `Ela vale até ${validade}.\n\n` +
        `Acesse ${link}, entre com o seu e-mail ou CPF e essa senha. ` +
        `Em seguida, você vai criar a sua própria senha.\n\n` +
        `Se você não esperava este e-mail, ignore-o.`,
      html: this.layout(
        `Olá, ${this.esc(primeiroNome)}!`,
        `<p>Seu cadastro no painel do profissional do PASI foi criado.</p>
         <p style="margin:20px 0;padding:16px;border-radius:12px;background:#e9f1ff;font:700 20px/1.3 monospace;letter-spacing:1px;color:#172944;text-align:center">${this.esc(senha)}</p>
         <p>Essa senha provisória vale até <strong>${this.esc(validade)}</strong>.</p>
         <p>Entre com o seu e-mail ou CPF e essa senha. Em seguida, você vai criar a sua própria senha.</p>`,
        { texto: 'Acessar o painel', url: link },
      ),
    });
  }

  /** Link do "Esqueci a senha", válido por 1 hora. */
  enviarLinkRedefinicao(para: string, nome: string, token: string) {
    const link = `${this.urlPainel()}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const primeiroNome = nome.split(' ')[0];
    return this.enviar({
      para,
      nome,
      assunto: 'PASI — redefinição de senha',
      texto:
        `Olá, ${primeiroNome}!\n\n` +
        `Recebemos um pedido para redefinir a sua senha no PASI.\n` +
        `Use este link, válido por 1 hora: ${link}\n\n` +
        `Se não foi você, ignore este e-mail; a sua senha continua a mesma.`,
      html: this.layout(
        `Olá, ${this.esc(primeiroNome)}!`,
        `<p>Recebemos um pedido para redefinir a sua senha no PASI.</p>
         <p>O link abaixo vale por <strong>1 hora</strong>.</p>
         <p style="color:#5b6b82;font-size:13px">Se não foi você, ignore este e-mail; a sua senha continua a mesma.</p>`,
        { texto: 'Criar nova senha', url: link },
      ),
    });
  }

  private urlPainel(): string {
    const url = this.config.get<string>('WEB_URL') ?? this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    return url.replace(/\/+$/, '');
  }

  private formatarDataHora(d: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(d);
  }

  private esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  }

  private layout(titulo: string, corpo: string, botao: { texto: string; url: string }): string {
    return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8faff;font-family:Montserrat,Arial,sans-serif;color:#172944">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 6px 24px rgba(16,39,70,.08)">
<tr><td style="font:700 22px/1.3 Montserrat,Arial,sans-serif;color:#172944;padding-bottom:12px">${titulo}</td></tr>
<tr><td style="font:400 15px/1.6 Montserrat,Arial,sans-serif;color:#33445c">${corpo}</td></tr>
<tr><td style="padding-top:20px"><a href="${this.esc(botao.url)}" style="display:inline-block;background:#2f70df;color:#ffffff;text-decoration:none;font:600 15px/1 Montserrat,Arial,sans-serif;padding:14px 22px;border-radius:12px">${this.esc(botao.texto)}</a></td></tr>
<tr><td style="padding-top:24px;font:400 12px/1.5 Montserrat,Arial,sans-serif;color:#7a889c">PASI — Plataforma de Atendimento de Sistemas Integrados</td></tr>
</table></td></tr></table></body></html>`;
  }
}
