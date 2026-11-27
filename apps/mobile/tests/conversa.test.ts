// Testes do ciclo de vida da conversa (Recomeçar e inatividade).
// Rodar: npm test (node --test, sem dependências).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControleConversa, INATIVIDADE_MS, expirou, juntarSinais } from '../src/assistente/conversa.ts';

test('resposta de uma conversa encerrada é descartada', () => {
  const c = new ControleConversa();
  const pergunta = c.iniciarRequisicao();
  assert.equal(c.ehAtual(pergunta.numero), true);
  c.encerrar(); // a pessoa tocou em Recomeçar antes da resposta chegar
  assert.equal(c.ehAtual(pergunta.numero), false);
  const nova = c.iniciarRequisicao();
  assert.equal(c.ehAtual(nova.numero), true);
});

test('Recomeçar cancela a requisição pendente', () => {
  const c = new ControleConversa();
  const pergunta = c.iniciarRequisicao();
  assert.equal(c.ocupada, true);
  c.encerrar();
  assert.equal(pergunta.signal.aborted, true);
  assert.equal(c.ocupada, false);
});

test('requisição concluída não é cancelada depois', () => {
  const c = new ControleConversa();
  const pergunta = c.iniciarRequisicao();
  pergunta.concluir();
  c.encerrar();
  assert.equal(pergunta.signal.aborted, false);
});

test('inatividade: só depois de 15 minutos sem atividade', () => {
  const c = new ControleConversa();
  assert.equal(c.inativa(Date.now() + INATIVIDADE_MS * 10), false); // sem atividade ainda: não expira
  c.registrarAtividade(1_000);
  assert.equal(c.inativa(1_000 + INATIVIDADE_MS), false);
  assert.equal(c.inativa(1_000 + INATIVIDADE_MS + 1), true);
  c.encerrar();
  assert.equal(c.inativa(1_000 + INATIVIDADE_MS * 2), false); // a conversa nova começa sem relógio
});

test('expirou', () => {
  assert.equal(expirou(null, 10), false);
  assert.equal(expirou(0, INATIVIDADE_MS + 1), true);
  assert.equal(expirou(0, 100, 50), true);
});

test('juntarSinais cancela quando qualquer um cancela', () => {
  const a = new AbortController();
  const b = new AbortController();
  const junto = juntarSinais(a.signal, b.signal);
  assert.equal(junto.aborted, false);
  a.abort();
  assert.equal(junto.aborted, true);

  const c = new AbortController();
  const d = new AbortController();
  const outro = juntarSinais(c.signal, d.signal);
  d.abort(); // tempo limite
  assert.equal(outro.aborted, true);

  const sozinho = new AbortController();
  assert.equal(juntarSinais(undefined, sozinho.signal), sozinho.signal);
});
