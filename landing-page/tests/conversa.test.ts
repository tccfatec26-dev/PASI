// Testes do ciclo de vida da conversa da assistente (Recomeçar e inatividade).
// Rodar: npm test (node --test, sem dependências). O mesmo módulo existe no app (apps/mobile).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ControleConversa, INATIVIDADE_MS, expirou, juntarSinais } from "../src/components/Assistente/conversa.ts";

test("resposta atrasada de uma conversa encerrada é descartada", () => {
  const c = new ControleConversa();
  const pergunta = c.iniciarRequisicao();
  c.encerrar(); // Recomeçar enquanto a IA respondia
  assert.equal(c.ehAtual(pergunta.numero), false);
  assert.equal(pergunta.signal.aborted, true);
  assert.equal(c.ehAtual(c.iniciarRequisicao().numero), true);
});

test("várias perguntas pendentes são todas canceladas", () => {
  const c = new ControleConversa();
  const a = c.iniciarRequisicao();
  const b = c.iniciarRequisicao();
  c.encerrar();
  assert.equal(a.signal.aborted && b.signal.aborted, true);
  assert.equal(c.ocupada, false);
});

test("inatividade de 15 minutos", () => {
  const c = new ControleConversa();
  c.registrarAtividade(0);
  assert.equal(c.inativa(INATIVIDADE_MS), false);
  assert.equal(c.inativa(INATIVIDADE_MS + 1), true);
  assert.equal(expirou(null, INATIVIDADE_MS * 2), false);
});

test("tempo limite ou Recomeçar cancelam a requisição", () => {
  const conversa = new AbortController();
  const tempo = new AbortController();
  const sinal = juntarSinais(conversa.signal, tempo.signal);
  tempo.abort();
  assert.equal(sinal.aborted, true);
});
