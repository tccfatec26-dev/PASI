# tests/conftest.py
"""Peças falsas para testar SEM gastar chamadas de API (LLM, MongoDB e APIs públicas: CNES, MDS, IBGE, CEP).

Por que testar com peças falsas? O LLM não é determinístico e custa tokens.
Aqui testamos o NOSSO código: se o fluxo, as ferramentas e a memória funcionam.
"""
import json
import os
import sys
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

sys.path.insert(0, str(Path(__file__).parent.parent))
for chave in ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"):
    os.environ[chave] = ""  # testes nunca mandam nada para fora

from app.llm import fabrica  # noqa: E402

ARGS_PADRAO = {  # argumentos que o modelo falso usa ao pedir cada ferramenta
    "buscar_caps": {"municipio": "Mauá", "uf": "SP"},
    "buscar_cras_creas": {"tipo": "CRAS", "municipio": "Mauá", "uf": "SP"},
}


class ModeloFalso:
    """Imita um ChatModel: invoke() e bind_tools(). Anota quem foi chamado."""

    def __init__(self):
        self.rota = "conversa"       # o que o roteador falso vai responder
        self.ferramenta = None       # qual ferramenta o agente falso vai pedir
        self.chamadas = []           # registro: "roteador", "revisor", "tool:buscar_caps", "resposta"
        self.vistas = []             # mensagens recebidas na última chamada
        self._ferramentas = []

    def bind_tools(self, ferramentas):
        vinculado = ModeloFalso.__new__(ModeloFalso)
        vinculado.__dict__ = self.__dict__.copy()
        vinculado._dono = self
        vinculado._ferramentas = [f.name for f in ferramentas]
        return vinculado

    def _registrar(self, evento, mensagens):
        dono = getattr(self, "_dono", self)
        dono.chamadas.append(evento)
        dono.vistas = mensagens

    def invoke(self, mensagens, config=None):
        sistema = mensagens[0].content if mensagens else ""
        dono = getattr(self, "_dono", self)
        if "ROTEADOR" in sistema:
            self._registrar("roteador", mensagens)
            return AIMessage(content=f'Claro: {{"rota": "{dono.rota}", "motivo": "teste"}}')
        if "revisa a resposta" in sistema:
            self._registrar("revisor", mensagens)
            return AIMessage(content=mensagens[-1].content.split("especialista:\n")[-1] + "\n_aviso_")
        if "SUPERVISOR" in sistema:  # delega para cada especialista uma vez, depois encerra
            self._registrar("supervisor", mensagens)
            ja = {m.name for m in mensagens if isinstance(m, AIMessage)}
            proximo = next((e for e in ("mercado", "conhecimento") if e not in ja), "fim")
            return AIMessage(content=f'{{"proximo": "{proximo}"}}')
        if "LLM-as-judge" in sistema:
            self._registrar("juiz", mensagens)
            return AIMessage(content='{"nota": 0.9, "comentario": "ok"}')

        ultima_pergunta = max(i for i, m in enumerate(mensagens) if isinstance(m, HumanMessage))
        resultados = [m for m in mensagens[ultima_pergunta:] if isinstance(m, ToolMessage)]
        if self._ferramentas and not resultados:  # ainda não usou ferramenta neste turno: pede uma
            nome = dono.ferramenta if dono.ferramenta in self._ferramentas else self._ferramentas[0]
            args = ARGS_PADRAO.get(nome, {"consulta": mensagens[ultima_pergunta].content})
            self._registrar(f"tool:{nome}", mensagens)
            return AIMessage(content="", tool_calls=[{"name": nome, "args": args, "id": f"call_{len(dono.chamadas)}"}])

        self._registrar("resposta", mensagens)
        dados = " | ".join(r.content[:300] for r in resultados)
        return AIMessage(content=f"resposta de teste. {dados}".strip(),
                         usage_metadata={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15})


def get_json_falso(url, params=None):
    """Imita as respostas documentadas das APIs públicas (IBGE, ViaCEP, BrasilAPI, MDS e CNES)."""
    if "servicodados.ibge.gov.br" in url:  # lista de cidades de uma UF
        return [{"id": 3529401, "nome": "Mauá"}, {"id": 3550308, "nome": "São Paulo"}]
    if "viacep.com.br" in url:  # CEP -> cidade (só o CEP de teste existe)
        if "09321090" in url:
            return {"cep": "09321-090", "bairro": "VILA BOCAINA", "localidade": "Mauá", "uf": "SP", "ibge": "3529401"}
        return {"erro": "true"}
    if "brasilapi.com.br" in url:  # CEP -> coordenadas (bem perto do CAPS AD)
        return {"cep": "09321090", "location": {"type": "Point",
                "coordinates": {"latitude": "-23.6890", "longitude": "-46.4410"}}}
    if "sagi/servicos/equipamentos" in url:  # CRAS/CREAS do MDS (formato Solr)
        tipo = [f for f in params["fq"] if f.startswith("tipo_equipamento:")][0].split(":")[1]
        docs = {
            "CRAS": [
                {"nome": "CRAS ZAIRA", "tipo_equipamento": "CRAS", "telefone": "1145551234",
                 "endereco": "RUA DO CRAS", "numero": "10", "bairro": "JARDIM ZAIRA", "cep": "09321-000",
                 "georef_location": "-23.6895,-46.4405", "data_atualizacao": "2026-06-01T03:00:00Z"},
                {"nome": "CRAS CENTRO", "tipo_equipamento": "CRAS", "telefone": "1145559999",
                 "endereco": "RUA CENTRAL", "numero": "5", "bairro": "CENTRO", "cep": "09310-000",
                 "georef_location": "-23.6670,-46.4610", "data_atualizacao": "2026-06-01T03:00:00Z"},
            ],
            "CREAS": [
                {"nome": ["CREAS MAUA"], "tipo_equipamento": ["CREAS"], "telefone": ["1145557777"],
                 "endereco": ["AVENIDA DO CREAS"], "numero": ["300"], "bairro": ["CENTRO"]},
            ],
        }[tipo]
        return {"response": {"numFound": len(docs), "docs": docs}}
    if "cnes/estabelecimentos" in url:  # CAPS (codigo_tipo_unidade=70) de Mauá
        if (params or {}).get("offset", 0) > 0:
            return {"estabelecimentos": []}
        return {"estabelecimentos": [
            {"codigo_cnes": 1111111, "nome_fantasia": "CAPS II ADULTO MAUA", "codigo_tipo_unidade": 70,
             "latitude_estabelecimento_decimo_grau": -23.6670, "longitude_estabelecimento_decimo_grau": -46.4610,
             "endereco_estabelecimento": "RUA EXEMPLO", "numero_estabelecimento": "100",
             "bairro_estabelecimento": "CENTRO", "codigo_cep_estabelecimento": "09310000",
             "numero_telefone_estabelecimento": "(11) 4555-0000",
             "descricao_turno_atendimento": "ATENDIMENTOS NOS TURNOS DA MANHA E A TARDE",
             "codigo_motivo_desabilitacao_estabelecimento": None, "data_atualizacao": "2026-10-01"},
            {"codigo_cnes": 2222222, "nome_fantasia": "CAPS AD III MAUA", "codigo_tipo_unidade": 70,
             "latitude_estabelecimento_decimo_grau": -23.6900, "longitude_estabelecimento_decimo_grau": -46.4400,
             "endereco_estabelecimento": "AVENIDA TESTE", "numero_estabelecimento": "200",
             "bairro_estabelecimento": "VILA BOCAINA", "codigo_cep_estabelecimento": "09320000",
             "numero_telefone_estabelecimento": "(11) 4555-1111",
             "descricao_turno_atendimento": "ATENDIMENTO CONTINUO DE 24 HORAS",
             "codigo_motivo_desabilitacao_estabelecimento": None, "data_atualizacao": "2026-10-01"},
            {"codigo_cnes": 3333333, "nome_fantasia": "CAPS DESATIVADO", "codigo_tipo_unidade": 70,
             "codigo_motivo_desabilitacao_estabelecimento": "01"},
        ]}
    raise ValueError(f"URL inesperada no teste: {url}")


@pytest.fixture
def falso(monkeypatch):
    modelo = ModeloFalso()
    monkeypatch.setattr(fabrica, "criar_modelo", lambda temperatura=0.3: modelo)

    try:  # Aula 3+: MongoDB em memória e checkpointer em memória
        import mongomock
        from langgraph.checkpoint.memory import InMemorySaver

        from app.repository import checkpointer, mongo
        banco = mongomock.MongoClient().pasibot_teste
        monkeypatch.setattr(mongo, "banco", lambda: banco)
        monkeypatch.setattr(checkpointer, "criar_checkpointer", InMemorySaver)
        from app.agents import grafo
        grafo.grafo.cache_clear()
    except ImportError:
        pass

    try:  # Aula 4: APIs do CNES, do MDS, do IBGE e de CEP falsas
        from app.tools import unidades
        monkeypatch.setattr(unidades, "get_json", get_json_falso)
        unidades._municipios_da_uf.cache_clear()
        monkeypatch.setitem(unidades._ESTADO_MDS, "fora_ate", 0.0)  # MDS "no ar" em cada teste
    except ImportError:
        pass

    try:  # Aula 5+: documentos já indexados
        from app.rag.indexador import indexar
        indexar()
    except ImportError:
        pass
    return modelo


@pytest.fixture
def api(falso):
    from fastapi.testclient import TestClient

    from app.main import app
    return TestClient(app)


def conteudo_json(texto: str):
    return json.loads(texto)