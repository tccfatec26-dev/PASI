"""Triagem: o serviço (CRAS, CREAS ou CAPS) indicado para a situação da pessoa.

Até aqui a IA indicava o serviço só no texto da resposta. Os aplicativos (o app do paciente e a
landing) precisam desse resultado de forma estruturada para ligar a conversa à unidade certa.

Dois sinais, os dois vindos da própria conversa:
1. a ferramenta indicar_servico: a IA a chama quando a situação deixa claro qual serviço atende;
2. as buscas de unidade: se a IA chamou buscar_caps ou buscar_cras_creas, a pessoa pediu
   aquele serviço.

Sem um desses sinais, não há indicação (servico_indicado = None): o app pergunta mais ou
mostra a triagem por botões. Nada é deduzido por palavra solta.
"""
import json

from langchain_core.messages import AIMessage, AnyMessage, ToolMessage
from langchain_core.tools import tool

SERVICOS = ("CRAS", "CREAS", "CAPS")


@tool
def indicar_servico(servico: str, motivo: str) -> dict:
    """Registra qual serviço público atende a situação da pessoa, para o aplicativo mostrar a unidade certa.
    Chame UMA vez, quando a conversa já deixar CLARO qual é o serviço:
      "CRAS"  = Cadastro Único, Bolsa Família, BPC, benefícios, renda, apoio à família;
      "CREAS" = violação de direitos já acontecida: violência, abuso, negligência, abandono, trabalho infantil;
      "CAPS"  = sofrimento psíquico intenso, crises, uso de álcool ou outras drogas.
    NÃO chame se ainda houver dúvida ou se a situação servir para mais de um serviço: faça uma pergunta.
    NÃO chame só porque a pessoa perguntou o que é um serviço.
    motivo: uma frase curta com o que a pessoa contou (sem dados pessoais)."""
    servico = (servico or "").strip().upper()
    if servico not in SERVICOS:
        return {"erro": f"servico '{servico}' inválido. Use CRAS, CREAS ou CAPS."}
    return {"servico_indicado": servico, "motivo": (motivo or "").strip()[:200]}


FERRAMENTAS_TRIAGEM = [indicar_servico]


def _conteudo(mensagem: ToolMessage) -> dict:
    try:
        conteudo = json.loads(mensagem.content)
    except (TypeError, ValueError):
        return {}
    return conteudo if isinstance(conteudo, dict) else {}


def servico_da_conversa(mensagens: list[AnyMessage]) -> dict | None:
    """O serviço indicado mais recente da sessão: {"servico", "origem", "motivo"} ou None.

    origem = "ia" (indicar_servico) ou "busca" (a pessoa pediu unidades daquele serviço).
    O histórico fica no checkpointer, então a indicação vale para a sessão inteira até mudar.
    """
    for mensagem in reversed(mensagens):
        if isinstance(mensagem, ToolMessage) and mensagem.name == "indicar_servico":
            conteudo = _conteudo(mensagem)
            if conteudo.get("servico_indicado") in SERVICOS:
                return {"servico": conteudo["servico_indicado"], "origem": "ia", "motivo": conteudo.get("motivo", "")}
        if isinstance(mensagem, AIMessage):
            for chamada in reversed(mensagem.tool_calls or []):
                args = chamada.get("args") or {}
                if chamada.get("name") == "buscar_caps":
                    return {"servico": "CAPS", "origem": "busca", "motivo": ""}
                if chamada.get("name") == "buscar_cras_creas":
                    tipo = str(args.get("tipo", "")).strip().upper()
                    if tipo in ("CRAS", "CREAS"):
                        return {"servico": tipo, "origem": "busca", "motivo": ""}
    return None
