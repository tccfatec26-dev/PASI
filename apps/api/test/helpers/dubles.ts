import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../src/auth/current-user.decorator';
import { SituacaoUsuario, TipoUsuario } from '../../src/common/constants';

/**
 * Objeto cujos métodos viram jest.fn() no primeiro acesso. Substitui
 * serviços injetados sem precisar declarar cada método usado.
 */
export function criarDuble(): any {
  return new Proxy<Record<string | symbol, unknown>>(
    {},
    {
      get(alvo, chave) {
        // "then" e símbolos: o objeto não pode parecer uma Promise para o await.
        if (typeof chave === 'symbol' || chave === 'then') return undefined;
        if (!(chave in alvo)) alvo[chave] = jest.fn();
        return alvo[chave];
      },
    },
  );
}

/**
 * Dublê do PrismaService: cada modelo (prisma.usuario, prisma.atendimento...)
 * é um criarDuble(). Nenhum teste unitário abre conexão com o banco.
 * $transaction aceita as duas formas usadas no projeto: lista de operações
 * e callback, que recebe o próprio dublê como cliente da transação.
 */
export function criarPrismaMock(): any {
  const modelos: Record<string, unknown> = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as unknown[]),
    ),
  };
  const prisma: any = new Proxy(modelos, {
    get(alvo, chave) {
      if (typeof chave === 'symbol' || chave === 'then') return undefined;
      if (!(chave in alvo)) alvo[chave] = criarDuble();
      return alvo[chave];
    },
  });
  return prisma;
}

/** Erro conhecido do Prisma com o código informado (P2002, P2025...). */
export function erroPrisma(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('erro simulado', {
    code,
    clientVersion: 'teste',
    meta,
  });
}

const usuario = (id_usuario: number, tipo: number): AuthUser => ({
  id_usuario,
  tipo,
  email: `usuario${id_usuario}@pasi.test`,
  situacao: SituacaoUsuario.DEFERIDO,
});

export const paciente = usuario(10, TipoUsuario.PACIENTE);
export const intermediario = usuario(20, TipoUsuario.INTERMEDIARIO);
export const maximo = usuario(30, TipoUsuario.MAXIMO);

/** Caso de delegação: [método do controller, argumentos, método do serviço, argumentos esperados]. */
export type CasoDelegacao = [string, unknown[], string, unknown[]];

/** Confere que cada rota repassa os argumentos ao serviço e devolve o resultado dele. */
export function testarDelegacao(
  controller: any,
  servico: any,
  casos: CasoDelegacao[],
) {
  it.each(casos)(
    '%s repassa os dados ao serviço e devolve o resultado',
    (metodo, args, metodoServico, argsEsperados) => {
      const resultado = { ok: metodo };
      servico[metodoServico].mockReturnValue(resultado);

      expect(controller[metodo](...args)).toBe(resultado);
      expect(servico[metodoServico]).toHaveBeenCalledWith(...argsEsperados);
    },
  );
}
