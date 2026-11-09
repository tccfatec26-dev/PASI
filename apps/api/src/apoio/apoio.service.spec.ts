import { criarPrismaMock } from '../../test/helpers/dubles';
import { ApoioService } from './apoio.service';

describe('ApoioService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: ApoioService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new ApoioService(prisma);
  });

  it.each([
    ['generos', 'genero', { id_genero: 'asc' }],
    ['profissoes', 'profissao', { nome: 'asc' }],
    ['unidades', 'unidade_atendimento', { nome: 'asc' }],
    [
      'tiposUnidade',
      'tipo_unidade_atendimento',
      { id_tipo_unidade_atend: 'asc' },
    ],
    ['tiposFormulario', 'tipo_formulario', { id_tipo_formulario: 'asc' }],
    ['tiposPergunta', 'tipo_pergunta', { id_tipo_pergunta: 'asc' }],
    [
      'situacoesAtendimento',
      'situacao_atendimento',
      { id_situacao_atendimento: 'asc' },
    ],
    [
      'situacoesFormulario',
      'situacao_formulario',
      { id_situacao_formulario: 'asc' },
    ],
  ] as const)('%s consulta %s na ordem esperada', (metodo, modelo, orderBy) => {
    const linhas = [{ id: 1 }];
    prisma[modelo].findMany.mockReturnValue(linhas);

    expect(service[metodo]()).toBe(linhas);
    expect(prisma[modelo].findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy }),
    );
  });

  it('tiposPergunta traz apenas os tipos ativos', () => {
    void service.tiposPergunta();
    expect(prisma.tipo_pergunta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
  });
});
