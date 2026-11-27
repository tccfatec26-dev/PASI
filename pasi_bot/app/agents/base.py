# app/agents/base.py
"""Aula 4 — O motor de qualquer agente: o LOOP de tool-calling.

        ┌──────────┐  pediu ferramenta?  ┌──────────────┐
  ──▶  │  pensar   │ ──────── sim ─────▶ │ ferramentas  │
        └──────────┘ ◀─── resultado ──── └──────────────┘
             │ não (resposta final)          passou do limite, repetiu o pedido
             ▼                                ou a ferramenta falhou 2 vezes
            FIM  ◀──────── responder ◀────────┘  (LLM responde SEM ferramentas)

- O LLM NÃO executa nada: ele devolve um pedido (nome da ferramenta + argumentos).
- Quem executa é o nosso código (ToolNode). O resultado volta para o LLM.
- Guardrail em CÓDIGO: no máximo MAX_PASSOS voltas POR PERGUNTA. Regra no prompt o modelo pode
  ignorar; um "if" no código, não. Ao bater no guardrail, o agente não desiste: responde com o
  que já conseguiu, sem ferramentas.

Agente = LLM + Ferramentas + Memória.
"""
import json
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.config.settings import settings
from app.llm import fabrica
from app.llm.observabilidade import config_prompt
from app.prompts import catalogo
from app.utils.mensagens import conversa_limpa, turno_atual


# Estado do agente: as mensagens, o perfil do usuário e quantas voltas o loop já deu.
class EstadoAgente(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]  # add_messages = ACRESCENTA, não substitui
    perfil: str
    passos: int  # contador de voltas (informativo; o guardrail conta só o turno atual, ver _do_turno)


def _do_turno(mensagens: list[AnyMessage]) -> list[AnyMessage]:
    """Mensagens desde a última pergunta do usuário (a pergunta inclusive)."""
    ultima = max((i for i, m in enumerate(mensagens) if isinstance(m, HumanMessage)), default=0)
    return list(mensagens[ultima:])


def _assinatura(chamada: dict) -> str:
    """Nome + argumentos de uma chamada de ferramenta, para reconhecer pedidos repetidos."""
    return chamada["name"] + json.dumps(chamada.get("args", {}), sort_keys=True, ensure_ascii=False)


def _deu_erro(mensagem: AnyMessage) -> bool:
    """O resultado da ferramenta foi {"erro": ...}?"""
    try:
        conteudo = json.loads(mensagem.content)
    except (TypeError, ValueError):
        return False
    return isinstance(conteudo, dict) and "erro" in conteudo


def criar_agente(nome: str, nome_prompt: str, ferramentas: list, checkpointer=None):
    """Monta e compila o grafo de um agente com ferramentas."""

    # Nomes das ferramentas em texto (usado no lembrete se o modelo errar o nome).
    nomes_validos = ", ".join(f.name for f in ferramentas)

    # Nó "pensar": o LLM lê a conversa e decide se responde ou se pede uma ferramenta.
    def pensar(estado: EstadoAgente) -> dict:
        prompt = catalogo.obter(nome_prompt)
        sistema = SystemMessage(prompt.compile(perfil=estado.get("perfil", "não informado")))
        # temperatura=0.1: respostas mais estáveis; bind_tools mostra as ferramentas ao modelo.
        modelo = fabrica.criar_modelo(temperatura=0.1).bind_tools(ferramentas)
        # Histórico limpo + tudo do turno atual (inclusive resultados de ferramentas).
        mensagens = [sistema] + turno_atual(estado["messages"])
        try:
            resposta = modelo.invoke(mensagens, config=config_prompt(prompt))
        except Exception as erro:
            print(f"[{nome}] 1ª tentativa falhou: {erro}")  # aparece no terminal do uvicorn
            # Guardrail: o modelo pode errar o nome da ferramenta (caso real: "taxa\u200bs_bcb")
            # e o provedor recusa o pedido. Tentamos UMA vez de novo, lembrando os nomes certos.
            # Se o erro não for de ferramenta, não há o que corrigir: deixa o erro subir.
            if "tool" not in str(erro).lower():
                raise
            lembrete = SystemMessage(f"Atenção: use SOMENTE estas ferramentas, com o nome exato: {nomes_validos}.")
            try:
                resposta = modelo.invoke(mensagens + [lembrete], config=config_prompt(prompt))
            except Exception as erro2:
                print(f"[{nome}] 2ª tentativa falhou: {erro2}")
                aviso = "Tive um problema ao consultar os dados agora. Pode repetir a pergunta?"
                resposta = AIMessage(content=aviso)
        # Marca qual agente respondeu e soma 1 no contador de voltas.
        resposta.name = nome
        return {"messages": [resposta], "passos": estado.get("passos", 0) + 1}

    # Aresta condicional: decide para onde ir depois de "pensar".
    def proximo(estado: EstadoAgente) -> str:
        # Se a última mensagem não pediu ferramenta (tool_calls vazio), é a resposta final.
        ultima = estado["messages"][-1]
        if not getattr(ultima, "tool_calls", None):
            return END                      # resposta final
        turno = _do_turno(estado["messages"])
        # Guardrails, contados SÓ neste turno (o estado é salvo entre perguntas pelo checkpointer):
        # 1) voltas demais;
        pedidos = [m for m in turno if getattr(m, "tool_calls", None)]
        if len(pedidos) >= settings.max_passos_agente:
            return "responder"
        # 2) o modelo repetiu um pedido que já fez (mesma ferramenta, mesmos argumentos);
        anteriores = {_assinatura(c) for m in pedidos[:-1] for c in m.tool_calls}
        if all(_assinatura(c) in anteriores for c in ultima.tool_calls):
            return "responder"
        # 3) a ferramenta já falhou duas vezes: insistir não vai ajudar.
        if sum(_deu_erro(m) for m in turno if m.type == "tool") >= 2:
            return "responder"
        return "ferramentas"

    # Nó "responder": em vez de desistir, o LLM responde SEM ferramentas, com o que já conseguiu.
    def responder(estado: EstadoAgente) -> dict:
        try:
            prompt = catalogo.obter(nome_prompt)
            sistema = SystemMessage(prompt.compile(perfil=estado.get("perfil", "não informado")))
            turno = _do_turno(estado["messages"])
            resultados = [m.content for m in turno if m.type == "tool"][-3:]
            instrucao = SystemMessage(
                "Você já consultou as ferramentas. NÃO peça outra ferramenta: responda agora à pessoa "
                "usando só estes resultados. Se algum trouxer 'erro' ou 'alternativa', explique com calma "
                "e passe a alternativa. Nunca invente endereços ou telefones.\n\nResultados:\n"
                + ("\n---\n".join(resultados) or "nenhum resultado útil")
            )
            # Sem bind_tools: o modelo não tem como pedir ferramenta. Os resultados vão como texto.
            mensagens = [sistema] + conversa_limpa(estado["messages"][:-len(turno)]) + [turno[0], instrucao]
            resposta = fabrica.criar_modelo(temperatura=0.1).invoke(mensagens, config=config_prompt(prompt))
            return {"messages": [AIMessage(content=resposta.content, name=nome)]}
        except Exception as erro:
            print(f"[{nome}] não consegui montar a resposta final: {erro}")
            return limite(estado)

    # Nó "limite": último recurso, quando nem a resposta final sem ferramentas deu certo.
    def limite(estado: EstadoAgente) -> dict:
        aviso = ("Não consegui concluir a consulta agora. Pode tentar de novo em instantes "
                 "ou informar a cidade e o estado?")
        return {"messages": [AIMessage(content=aviso, name=nome)]}

    # Monta o grafo: pensar -> (ferramentas -> pensar)... até a resposta final ou o limite.
    g = StateGraph(EstadoAgente)
    g.add_node("pensar", pensar)
    g.add_node("ferramentas", ToolNode(ferramentas))  # ToolNode executa as ferramentas pedidas pelo LLM
    g.add_node("responder", responder)
    g.add_edge(START, "pensar")
    # Depois de "pensar", a função proximo() escolhe o caminho: ferramentas, responder ou END.
    g.add_conditional_edges("pensar", proximo, ["ferramentas", "responder", END])
    g.add_edge("ferramentas", "pensar")     # o resultado volta para o LLM
    g.add_edge("responder", END)
    return g.compile(checkpointer=checkpointer, name=nome)


def fontes_do_turno(mensagens: list[AnyMessage]) -> list[str]:
    """Junta o campo 'fonte' dos resultados das ferramentas usadas neste turno."""
    fontes = set()
    # Percorre as mensagens e olha só os resultados de ferramentas (type == "tool").
    for m in mensagens:
        if m.type != "tool":
            continue
        # O resultado da ferramenta vem como texto JSON; se não for JSON, pula.
        try:
            conteudo = json.loads(m.content)
        except (TypeError, ValueError):
            continue
        # O resultado pode ser um item ou uma lista de itens: tratamos os dois casos.
        itens = conteudo if isinstance(conteudo, list) else [conteudo]
        fontes.update(i["fonte"] for i in itens if isinstance(i, dict) and i.get("fonte"))
    return sorted(fontes)  # set evita repetidas; sorted devolve em ordem alfabética
