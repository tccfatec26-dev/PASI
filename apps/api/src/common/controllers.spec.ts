import { ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import {
  CasoDelegacao,
  criarDuble,
  criarPrismaMock,
  maximo,
  testarDelegacao,
} from '../../test/helpers/dubles';
import { ApoioController } from '../apoio/apoio.controller';
import { AtendimentosController } from '../atendimentos/atendimentos.controller';
import { AuthController } from '../auth/auth.controller';
import { AvaliacoesController } from '../avaliacoes/avaliacoes.controller';
import { DocumentosController } from '../documentos/documentos.controller';
import { FormulariosController } from '../formularios/formularios.controller';
import { GestaoUsuariosController } from '../gestao/gestao-usuarios.controller';
import { HealthController } from '../health/health.controller';
import { RespostasController } from '../respostas/respostas.controller';
import { UsuariosController } from '../usuarios/usuarios.controller';

// O controller de documentos cria a pasta de uploads ao ser carregado.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  createReadStream: jest.fn(),
}));

const u = maximo;
const dto = { campo: 'valor' };

describe('Controllers: repasse ao serviço', () => {
  describe('AuthController', () => {
    const servico = criarDuble();
    testarDelegacao(new AuthController(servico), servico, [
      ['login', [dto], 'login', [dto]],
      ['primeiroAcesso', [u, dto], 'primeiroAcesso', [u, dto]],
      ['esqueceuSenha', [dto], 'esqueceuSenha', [dto]],
      ['redefinirSenha', [dto], 'redefinirSenha', [dto]],
    ] as CasoDelegacao[]);

    it('me devolve o usuário autenticado', () => {
      expect(new AuthController(servico).me(u)).toBe(u);
    });
  });

  describe('UsuariosController', () => {
    const servico = criarDuble();
    testarDelegacao(new UsuariosController(servico), servico, [
      ['createPaciente', [dto], 'createPaciente', [dto]],
      ['listPacientes', ['ana', u], 'listPacientes', ['ana', u]],
      ['me', [u], 'findById', [u.id_usuario]],
      ['updateMe', [dto, u], 'updateMe', [u, dto]],
      ['confirmarDados', [u], 'confirmarDados', [u]],
      ['trocarSenha', [dto, u], 'trocarSenha', [u, dto]],
      [
        'vincularPropria',
        [{ id_unidade_atendimento: 1, sede: true }, u],
        'vincularPropria',
        [u, 1, true],
      ],
      [
        'vincularPropria',
        [{ id_unidade_atendimento: 1 }, u],
        'vincularPropria',
        [u, 1, false],
      ],
      ['desvincularPropria', [1, u], 'desvincularPropria', [u, 1]],
      ['trocarSedePropria', [1, u], 'trocarSedePropria', [u, 1]],
    ] as CasoDelegacao[]);
  });

  describe('AtendimentosController', () => {
    const servico = criarDuble();
    testarDelegacao(new AtendimentosController(servico), servico, [
      ['create', [dto, u], 'create', [dto, u]],
      ['findAll', [dto, u], 'findAll', [dto, u]],
      ['findOne', [1, u], 'findOne', [1, u]],
      ['update', [1, dto, u], 'update', [1, dto, u]],
      ['atribuirFormularios', [1, dto, u], 'atribuirFormularios', [1, dto, u]],
      ['removerFormulario', [1, 2, u], 'removerFormulario', [1, 2, u]],
      ['encerrar', [1, u], 'encerrar', [1, u]],
      ['inativar', [1, u], 'inativar', [1, u]],
    ] as CasoDelegacao[]);
  });

  describe('RespostasController', () => {
    const servico = criarDuble();
    testarDelegacao(new RespostasController(servico), servico, [
      ['iniciar', [1, 2, u], 'iniciar', [1, 2, u]],
      ['detalhar', [1, 2, u], 'detalhar', [1, 2, u]],
      ['salvar', [1, 2, dto, u], 'salvar', [1, 2, dto, u]],
      ['concluir', [1, 2, u], 'concluir', [1, 2, u]],
    ] as CasoDelegacao[]);
  });

  describe('AvaliacoesController', () => {
    const servico = criarDuble();
    testarDelegacao(new AvaliacoesController(servico), servico, [
      ['iniciar', [1, 2, u], 'iniciar', [1, 2, u]],
      ['avaliar', [1, 2, dto, u], 'avaliar', [1, 2, dto, u]],
      ['listar', [1, 2, u], 'listar', [1, 2, u]],
    ] as CasoDelegacao[]);
  });

  describe('FormulariosController', () => {
    const servico = criarDuble();
    testarDelegacao(new FormulariosController(servico), servico, [
      ['create', [dto, u], 'create', [dto, u]],
      ['findAll', [dto], 'findAll', [dto]],
      ['findOne', [1], 'findOne', [1]],
      ['update', [1, dto, u], 'update', [1, dto, u]],
      ['desativar', [1, u], 'desativar', [1, u]],
      ['reativar', [1, u], 'reativar', [1, u]],
      ['addPergunta', [1, dto, u], 'addPergunta', [1, dto, u]],
      ['updatePergunta', [1, 5, dto, u], 'updatePergunta', [1, 5, dto, u]],
      ['removePergunta', [1, 5, u], 'removePergunta', [1, 5, u]],
    ] as CasoDelegacao[]);
  });

  describe('GestaoUsuariosController', () => {
    const servico = criarDuble();
    testarDelegacao(new GestaoUsuariosController(servico), servico, [
      ['listar', [dto, u], 'listar', [dto, u]],
      ['cadastrar', [dto, u], 'cadastrarProfissional', [dto, u]],
      ['detalhar', [5, u], 'detalhar', [5, u]],
      ['reenviarSenha', [5, u], 'reenviarSenha', [5, u]],
      [
        'corrigirEmail',
        [5, { email: 'a@b.com' }, u],
        'corrigirEmail',
        [5, 'a@b.com', u],
      ],
      ['inativar', [5, u], 'inativar', [5, u]],
      ['reativar', [5, u], 'reativar', [5, u]],
      ['promover', [5, u], 'promover', [5, u]],
      [
        'vincularUnidade',
        [5, { id_unidade_atendimento: 1, sede: true }, u],
        'vincularUnidade',
        [5, 1, true, u],
      ],
      [
        'vincularUnidade',
        [5, { id_unidade_atendimento: 1 }, u],
        'vincularUnidade',
        [5, 1, false, u],
      ],
      ['desvincularUnidade', [5, 1, u], 'desvincularUnidade', [5, 1, u]],
      ['trocarSede', [5, 1, u], 'trocarSede', [5, 1, u]],
    ] as CasoDelegacao[]);
  });

  describe('ApoioController', () => {
    const servico = criarDuble();
    testarDelegacao(
      new ApoioController(servico),
      servico,
      [
        'generos',
        'profissoes',
        'unidades',
        'tiposUnidade',
        'tiposFormulario',
        'tiposPergunta',
        'situacoesAtendimento',
        'situacoesFormulario',
      ].map((m): CasoDelegacao => [m, [], m, []]),
    );
  });

  describe('DocumentosController', () => {
    const servico = criarDuble();
    const controller = new DocumentosController(servico);
    const arquivo = { originalname: 'a.pdf' };

    testarDelegacao(controller, servico, [
      ['upload', [2, arquivo, u], 'registrarParaFormulario', [2, arquivo, u]],
      ['listar', [2, u], 'listarPorFormulario', [2, u]],
      ['remover', [1, u], 'remover', [1, u]],
    ] as CasoDelegacao[]);

    it.each([
      ['ficha.pdf', 'attachment; filename="ficha.pdf"'],
      [null, 'attachment; filename="arquivo"'],
    ])(
      'download entrega o arquivo com o nome %p',
      async (nome_fisico, disposicao) => {
        servico.paraDownload.mockResolvedValue({
          caminho: '/uploads/1.pdf',
          nome_fisico,
        });
        jest
          .mocked(createReadStream)
          .mockReturnValue(Readable.from(['conteúdo']) as never);

        const resposta = await controller.download(1, u);

        expect(createReadStream).toHaveBeenCalledWith('/uploads/1.pdf');
        expect(resposta).toBeInstanceOf(StreamableFile);
        expect(resposta.getHeaders().disposition).toBe(disposicao);
      },
    );
  });

  describe('HealthController', () => {
    it('informa que a API e o banco estão no ar', async () => {
      const prisma = criarPrismaMock();
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      await expect(new HealthController(prisma).check()).resolves.toEqual({
        status: 'ok',
        banco: 'ok',
      });
    });

    it('responde 503 quando o banco não responde', async () => {
      const prisma = criarPrismaMock();
      prisma.$queryRaw.mockRejectedValue(new Error('sem conexão'));
      await expect(new HealthController(prisma).check()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
