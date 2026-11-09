import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  const CONFIG_COMPLETA: Record<string, string> = {
    BREVO_API_KEY: 'chave-de-teste',
    MAIL_FROM_EMAIL: 'contato@pasi.test',
    WEB_URL: 'https://painel.pasi.test/',
  };
  const email = {
    para: 'ana@pasi.test',
    nome: 'Ana',
    assunto: 'Assunto',
    html: '<p>Oi</p>',
    texto: 'Oi',
  };

  let fetchMock: jest.SpyInstance;

  const criar = (config: Record<string, string> = CONFIG_COMPLETA) =>
    new MailService({
      get: (k: string) => config[k],
    } as unknown as ConfigService);

  const corpoEnviado = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  beforeEach(() => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('enviar', () => {
    it.each([
      ['a chave da API', { MAIL_FROM_EMAIL: 'c@p.test' }],
      ['o remetente', { BREVO_API_KEY: 'k' }],
    ])('não chama o provedor sem %s', async (_nome, config) => {
      await expect(
        criar(config as Record<string, string>).enviar(email),
      ).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('envia pela API do Brevo com a chave no cabeçalho', async () => {
      await expect(criar().enviar(email)).resolves.toBe(true);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(init.headers['api-key']).toBe('chave-de-teste');
      expect(corpoEnviado()).toMatchObject({
        sender: { email: 'contato@pasi.test', name: 'PASI' },
        to: [{ email: 'ana@pasi.test', name: 'Ana' }],
        subject: 'Assunto',
      });
    });

    it('omite o nome do destinatário quando não informado', async () => {
      await criar().enviar({ ...email, nome: undefined });
      expect(corpoEnviado().to).toEqual([{ email: 'ana@pasi.test' }]);
    });

    it('devolve false quando o provedor recusa', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('negado'),
      });
      await expect(criar().enviar(email)).resolves.toBe(false);
    });

    it('devolve false em falha de rede, sem lançar erro', async () => {
      fetchMock.mockRejectedValue(new Error('sem conexão'));
      await expect(criar().enviar(email)).resolves.toBe(false);
    });
  });

  describe('enviarSenhaProvisoria', () => {
    const expira = new Date('2026-11-10T15:00:00.000Z');

    it('informa a senha, a validade no fuso de Brasília e o link do painel', async () => {
      await criar().enviarSenhaProvisoria(
        'ana@pasi.test',
        'Ana Lima',
        'Prov@123',
        expira,
      );
      const { textContent, subject } = corpoEnviado();
      expect(subject).toContain('senha provisória');
      expect(textContent).toContain('Olá, Ana!');
      expect(textContent).toContain('Prov@123');
      expect(textContent).toContain('10/11/2026');
      expect(textContent).toContain('12:00');
      expect(textContent).toContain('Acesse https://painel.pasi.test,');
    });

    it('escapa HTML vindo do nome e da senha', async () => {
      await criar().enviarSenhaProvisoria(
        'a@p.test',
        '<script>alert(1)</script> x',
        'a&b',
        expira,
      );
      const { htmlContent } = corpoEnviado();
      expect(htmlContent).not.toContain('<script>');
      expect(htmlContent).toContain('&lt;script&gt;');
      expect(htmlContent).toContain('a&amp;b');
    });

    it('usa o endereço local quando nenhuma URL está configurada', async () => {
      const { WEB_URL, ...semUrl } = CONFIG_COMPLETA;
      void WEB_URL;
      await criar(semUrl).enviarSenhaProvisoria('a@p.test', 'Ana', 's', expira);
      expect(corpoEnviado().textContent).toContain('http://localhost:5173');
    });
  });

  describe('enviarLinkRedefinicao', () => {
    it('monta o link com o token codificado e cita a validade', async () => {
      await criar().enviarLinkRedefinicao('ana@pasi.test', 'Ana Lima', 'a b/c');
      const { textContent } = corpoEnviado();
      expect(textContent).toContain(
        'https://painel.pasi.test/redefinir-senha?token=a%20b%2Fc',
      );
      expect(textContent).toContain('válido por 1 hora');
    });
  });
});
