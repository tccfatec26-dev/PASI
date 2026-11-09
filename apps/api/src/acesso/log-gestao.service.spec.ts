import { criarPrismaMock } from '../../test/helpers/dubles';
import { MODULO_GESTAO_USUARIOS } from '../common/constants';
import { LogGestaoService } from './log-gestao.service';

describe('LogGestaoService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: LogGestaoService;
  const params = {
    acao: 'Inativar usuário',
    idAutor: 1,
    idAlvo: 2,
    detalhe: 'motivo',
  };

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new LogGestaoService(prisma);
    prisma.modulo.findFirst.mockResolvedValue({ id_modulo: 3 });
    prisma.acao.findFirst.mockResolvedValue({ id_acao: 4 });
  });

  it('registra autor, alvo, módulo, ação e detalhe', async () => {
    await service.registrar(params);
    expect(prisma.log_adm_geral.create).toHaveBeenCalledWith({
      data: {
        id_modulo: 3,
        id_acao: 4,
        id_usuario_acao: 1,
        id_usuario_alvo: 2,
        detalhe: 'motivo',
      },
    });
  });

  it('cria módulo e ação quando ainda não existem', async () => {
    prisma.modulo.findFirst.mockResolvedValue(null);
    prisma.acao.findFirst.mockResolvedValue(null);
    prisma.modulo.create.mockResolvedValue({ id_modulo: 8 });
    prisma.acao.create.mockResolvedValue({ id_acao: 9 });

    await service.registrar(params);

    expect(prisma.modulo.create).toHaveBeenCalledWith({
      data: { nome: MODULO_GESTAO_USUARIOS },
    });
    expect(prisma.acao.create).toHaveBeenCalledWith({
      data: { nome: params.acao },
    });
    expect(prisma.log_adm_geral.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id_modulo: 8, id_acao: 9 }),
    });
  });

  it('guarda os ids em memória e não consulta de novo', async () => {
    await service.registrar(params);
    await service.registrar(params);
    expect(prisma.modulo.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.acao.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.log_adm_geral.create).toHaveBeenCalledTimes(2);
  });

  it('limita o detalhe a 500 caracteres', async () => {
    await service.registrar({ ...params, detalhe: 'x'.repeat(600) });
    const { data } = prisma.log_adm_geral.create.mock.calls[0][0];
    expect(data.detalhe).toHaveLength(500);
  });

  it('usa o cliente da transação quando informado', async () => {
    const tx = criarPrismaMock();
    tx.modulo.findFirst.mockResolvedValue({ id_modulo: 3 });
    tx.acao.findFirst.mockResolvedValue({ id_acao: 4 });

    await service.registrar(params, tx);

    expect(tx.log_adm_geral.create).toHaveBeenCalledTimes(1);
    expect(prisma.log_adm_geral.create).not.toHaveBeenCalled();
  });
});
