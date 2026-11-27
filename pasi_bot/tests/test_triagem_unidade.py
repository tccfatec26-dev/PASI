"""Triagem estruturada: o serviço indicado (CRAS, CREAS ou CAPS) volta no /chat para o app
ligar a conversa à unidade da pessoa. Ver app/tools/triagem.py."""
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from app.agents import grafo
from app.tools import triagem


def _pedido(nome, args, id_="c1"):
    return AIMessage(content="", tool_calls=[{"name": nome, "args": args, "id": id_}])


# ---------- a ferramenta ----------
def test_indicar_servico_aceita_so_os_tres_servicos():
    ok = triagem.indicar_servico.invoke({"servico": "cras", "motivo": "precisa do Cadastro Único"})
    assert ok == {"servico_indicado": "CRAS", "motivo": "precisa do Cadastro Único"}
    ruim = triagem.indicar_servico.invoke({"servico": "UBS", "motivo": "x"})
    assert "erro" in ruim


def test_descricao_explica_quando_nao_chamar():
    descricao = triagem.indicar_servico.description
    assert len(descricao) > 80
    assert "NÃO chame" in descricao


# ---------- leitura da conversa ----------
def test_sem_sinal_nao_indica_nada():
    mensagens = [HumanMessage("o que é o CRAS?"), AIMessage(content="O CRAS é...")]
    assert triagem.servico_da_conversa(mensagens) is None


def test_indicacao_da_ia():
    mensagens = [
        HumanMessage("meu vizinho bate nos filhos"),
        _pedido("indicar_servico", {"servico": "CREAS", "motivo": "violência"}),
        ToolMessage(content='{"servico_indicado": "CREAS", "motivo": "violência"}', name="indicar_servico",
                    tool_call_id="c1"),
        AIMessage(content="O CREAS é o lugar indicado."),
    ]
    assert triagem.servico_da_conversa(mensagens) == {"servico": "CREAS", "origem": "ia", "motivo": "violência"}


def test_indicacao_com_erro_e_ignorada():
    mensagens = [
        _pedido("indicar_servico", {"servico": "UBS", "motivo": ""}),
        ToolMessage(content='{"erro": "servico inválido"}', name="indicar_servico", tool_call_id="c1"),
    ]
    assert triagem.servico_da_conversa(mensagens) is None


def test_busca_pedida_conta_como_indicacao():
    assert triagem.servico_da_conversa([_pedido("buscar_caps", {"cep": "09321-090"})])["servico"] == "CAPS"
    creas = triagem.servico_da_conversa([_pedido("buscar_cras_creas", {"tipo": "creas", "municipio": "Mauá"})])
    assert creas == {"servico": "CREAS", "origem": "busca", "motivo": ""}


def test_vale_a_indicacao_mais_recente():
    mensagens = [
        _pedido("buscar_cras_creas", {"tipo": "CRAS", "municipio": "Mauá"}, "c1"),
        HumanMessage("na verdade é sobre bebida"),
        _pedido("indicar_servico", {"servico": "CAPS", "motivo": "álcool"}, "c2"),
        ToolMessage(content='{"servico_indicado": "CAPS", "motivo": "álcool"}', name="indicar_servico",
                    tool_call_id="c2"),
    ]
    assert triagem.servico_da_conversa(mensagens)["servico"] == "CAPS"


# ---------- no grafo e na API ----------
def test_chat_devolve_o_servico_indicado_e_ele_fica_na_sessao(falso):
    falso.ferramenta = "indicar_servico"
    saida = grafo.executar("Meu companheiro me agride", sessao="t-1")
    assert falso.chamadas == ["tool:indicar_servico", "resposta"]
    assert saida["servico_indicado"] == {"servico": "CREAS", "origem": "ia", "motivo": "relato de violência em casa"}

    # na pergunta seguinte da MESMA sessão, sem nova indicação, o registro continua
    falso.ferramenta = "buscar_caps"
    seguinte = grafo.executar("Onde fica?", sessao="t-1")
    assert seguinte["servico_indicado"]["servico"] == "CAPS"  # a busca pedida é o sinal mais recente


def test_sessao_nova_comeca_sem_indicacao(falso, monkeypatch):
    falso.ferramenta = "indicar_servico"
    grafo.executar("Meu companheiro me agride", sessao="t-antiga")
    # sem ferramentas: o modelo falso responde direto, sem sinal nenhum
    monkeypatch.setattr(falso, "ferramenta", None)
    original = falso.bind_tools
    monkeypatch.setattr(falso, "bind_tools", lambda ferramentas: original([]))
    nova = grafo.executar("Oi", sessao="t-nova")
    assert nova["servico_indicado"] is None


def test_api_aceita_resposta_sem_servico(api, falso):
    falso.ferramenta = "buscar_cras_creas"
    r = api.post("/chat", json={"mensagem": "Tem CRAS em Mauá?", "sessao": "t-api"})
    assert r.status_code == 200
    assert r.json()["servico_indicado"] == {"servico": "CRAS", "origem": "busca", "motivo": ""}
