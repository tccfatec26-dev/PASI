// Testes do vínculo da conversa com a unidade em que o paciente é atendido.
// Rodar: npm test (node --test, sem dependências).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chaveDoVinculo,
  contextoParaIa,
  resolverVinculo,
  tipoDaUnidade,
  unidadesDoUsuario,
  vinculoDoAtendimento,
  vinculoEscolhido,
} from '../src/assistente/vinculo.ts';

const INATIVO = 7;

// unidades como a rota /apoio/unidades devolve
const CADASTRO = [
  {
    id_unidade_atendimento: 1,
    nome: 'CRAS Centro',
    cidade: 'Mauá',
    estado: 'SP',
    tipo_unidade_atendimento: { nome: 'CRAS' },
  },
  {
    id_unidade_atendimento: 2,
    nome: 'CAPS II Mauá',
    cidade: 'Mauá',
    estado: 'SP',
    tipo_unidade_atendimento: { nome: 'Centro de Atenção Psicossocial' },
  },
  {
    id_unidade_atendimento: 3,
    nome: 'CRAS Zaíra',
    cidade: 'Mauá',
    estado: 'SP',
    tipo_unidade_atendimento: { nome: 'CRAS' },
  },
  {
    id_unidade_atendimento: 4,
    nome: 'Unidade Administrativa',
    cidade: 'Mauá',
    estado: 'SP',
    tipo_unidade_atendimento: { nome: 'Sede' },
  },
  {
    id_unidade_atendimento: 5,
    nome: 'CREAS Mauá',
    cidade: 'Mauá',
    estado: 'SP',
    tipo_unidade_atendimento: { nome: 'CREAS' },
  },
];

// atendimentos do paciente como a rota /atendimentos devolve
const atendimento = (id: number, unidade: number, situacao = 2) => ({
  id_atendimento: id,
  id_situacao_atendimento: situacao,
  unidade_atendimento: {
    id_unidade_atendimento: unidade,
    nome: CADASTRO.find((u) => u.id_unidade_atendimento === unidade)!.nome,
  },
});

test('tipo da unidade pela sigla ou pelo nome por extenso', () => {
  assert.equal(tipoDaUnidade('CRAS'), 'CRAS');
  assert.equal(tipoDaUnidade('CREAS'), 'CREAS'); // CREAS não pode virar CRAS
  assert.equal(tipoDaUnidade('Centro de Referência Especializado de Assistência Social'), 'CREAS');
  assert.equal(tipoDaUnidade('Centro de Referência de Assistência Social'), 'CRAS');
  assert.equal(tipoDaUnidade('CAPS AD III'), 'CAPS');
  assert.equal(tipoDaUnidade('Centro de Atenção Psicossocial'), 'CAPS');
  assert.equal(tipoDaUnidade('Sede administrativa'), null);
  assert.equal(tipoDaUnidade(null), null);
});

test('unidades do usuário vêm só dos atendimentos dele, sem os inativos', () => {
  const unidades = unidadesDoUsuario(
    [atendimento(10, 1), atendimento(11, 1), atendimento(12, 2), atendimento(13, 5, INATIVO)],
    CADASTRO,
    [INATIVO],
  );
  assert.deepEqual(
    unidades.map((u) => [u.id, u.tipo, u.atendimentos]),
    [
      [1, 'CRAS', [10, 11]],
      [2, 'CAPS', [12]],
    ],
  );
});

test('dúvida sobre formulário: vincula a unidade daquele atendimento', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1), atendimento(12, 2)], CADASTRO);
  const r = vinculoDoAtendimento(12, unidades);
  assert.equal(r.status, 'vinculada');
  if (r.status === 'vinculada') {
    assert.equal(r.vinculo.unidade.nome, 'CAPS II Mauá');
    assert.equal(r.vinculo.origem, 'formulario');
    assert.equal(r.vinculo.idAtendimento, 12);
  }
  // atendimento que não é do paciente: não vincula nada
  assert.equal(vinculoDoAtendimento(999, unidades).status, 'indefinido');
});

test('serviço indicado pela IA com uma unidade do tipo: vincula', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1), atendimento(12, 2)], CADASTRO);
  const r = resolverVinculo('CAPS', 'ia', unidades);
  assert.equal(r.status, 'vinculada');
  if (r.status === 'vinculada') assert.equal(r.vinculo.unidade.id, 2);
});

test('mais de uma unidade do tipo: a pessoa escolhe', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1), atendimento(14, 3)], CADASTRO);
  const r = resolverVinculo('CRAS', 'botao', unidades);
  assert.equal(r.status, 'escolher');
  if (r.status === 'escolher')
    assert.deepEqual(
      r.opcoes.map((u) => u.id),
      [1, 3],
    );
  const escolhida = vinculoEscolhido(3, unidades, 'CRAS');
  assert.equal(escolhida.status, 'vinculada');
});

test('sem unidade do tipo: não vincula (não inventa unidade)', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1)], CADASTRO);
  assert.deepEqual(resolverVinculo('CREAS', 'ia', unidades), { status: 'sem-unidade', servico: 'CREAS' });
  assert.deepEqual(resolverVinculo('CREAS', 'ia', []), { status: 'sem-unidade', servico: 'CREAS' });
});

test('palpite por palavras não vincula: pede confirmação', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1)], CADASTRO);
  assert.deepEqual(resolverVinculo('CRAS', 'palavras', unidades), { status: 'confirmar', servico: 'CRAS' });
});

test('sem serviço indicado: indefinido', () => {
  assert.deepEqual(resolverVinculo(null, 'ia', []), { status: 'indefinido' });
});

test('unidade de tipo desconhecido nunca é escolhida por tipo', () => {
  const unidades = unidadesDoUsuario([atendimento(15, 4)], CADASTRO);
  assert.equal(unidades[0].tipo, null);
  assert.equal(resolverVinculo('CRAS', 'ia', unidades).status, 'sem-unidade');
});

test('contexto enviado à IA e chave do vínculo', () => {
  const unidades = unidadesDoUsuario([atendimento(10, 1)], CADASTRO);
  const r = resolverVinculo('CRAS', 'ia', unidades);
  assert.equal(r.status, 'vinculada');
  if (r.status === 'vinculada') {
    assert.equal(
      contextoParaIa(r.vinculo),
      '(Contexto do atendimento: a pessoa já é atendida na unidade CRAS Centro (CRAS), Mauá/SP.)',
    );
    assert.equal(chaveDoVinculo(r.vinculo), '1:CRAS');
  }
  assert.equal(chaveDoVinculo(null), '');
});
