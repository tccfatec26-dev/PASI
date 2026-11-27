# app/tools/unidades.py
"""Aula 4 — Ferramentas (tools) que encontram as unidades públicas de atendimento perto da pessoa.

Duas ferramentas, uma para cada fonte de dados (como no FinBot, uma ferramenta por API):
- buscar_caps: CAPS (saúde mental), no CNES do Ministério da Saúde.
- buscar_cras_creas: CRAS (assistência social básica) e CREAS (violação de direitos), no cadastro do SUAS.

O que o modelo vê de cada ferramenta: o NOME, a DESCRIÇÃO (docstring) e os ARGUMENTOS.
A descrição é a única instrução que ele tem para decidir quando chamar:
descrição vaga = chamada errada. Por isso as docstrings abaixo são detalhadas.

Fontes gratuitas (sem cadastro e sem token):
- CNES / Ministério da Saúde: estabelecimentos de saúde. codigo_tipo_unidade=70 = CAPS. Exemplo:
  https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_tipo_unidade=70&codigo_municipio=355030&limit=10
- MDS (cadastro de equipamentos do SUAS, o mesmo do mapa MOPS): CRAS e CREAS.
  Reserva: se o MDS cair, usamos app/data/unidades_suas_2019.csv (Censo SUAS 2019, ver
  scripts/gerar_base_suas.py). Desde 21/10/2026 o MDS está fora do ar para manutenção.
- IBGE (localidades): nome da cidade -> código IBGE.
- ViaCEP: CEP -> cidade (código IBGE) e bairro.
- BrasilAPI (CEP v2): CEP -> latitude e longitude, para ordenar por distância.

O CNES e o MDS usam o código IBGE da cidade SEM o último dígito (São Paulo = 355030).

Teste sem LLM:  python -m app.tools.unidades
"""
import csv
import math
import re
import time
import unicodedata
from functools import lru_cache, wraps  # wraps preserva nome e docstring ao "embrulhar" uma função
from pathlib import Path

from langchain_core.tools import tool

from app.utils.http import get_json

# ---------- Endereços das APIs ----------
CNES = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos"
MDS = "https://aplicacoes.mds.gov.br/sagi/servicos/equipamentos"
MOPS = "https://aplicacoes.mds.gov.br/sagi/mops/"  # mapa oficial, para indicar ao usuário se a API falhar
IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios"
VIACEP = "https://viacep.com.br/ws/{cep}/json/"
BRASILAPI_CEP = "https://brasilapi.com.br/api/cep/v2/{cep}"

FONTES = {
    "CAPS": "CNES / Ministério da Saúde",
    "CRAS": "MDS - cadastro de equipamentos do SUAS",
    "CREAS": "MDS - cadastro de equipamentos do SUAS",
}
CAMPOS_MDS = ("nome,tipo_equipamento,ibge,cidade,uf,telefone,email,endereco,numero,complemento,"
              "referencia,bairro,cep,georef_location,data_atualizacao")
TIPO_CAPS = 70        # código do tipo de unidade "Centro de Atenção Psicossocial" no CNES
POR_PAGINA = 20       # a API do CNES devolve no máximo 20 por página
MAX_PAGINAS = 8       # até 160 CAPS (a cidade de São Paulo tem perto de 100)
MAX_RESULTADOS = 10   # quantas unidades devolvemos ao modelo (mais que isso só gasta tokens)
MAIS_PROXIMOS = 5     # com CEP, devolvemos só as 5 mais próximas

# Reserva local de CRAS e CREAS, usada quando o cadastro do MDS não responde.
BASE_SUAS_LOCAL = Path(__file__).parent.parent / "data" / "unidades_suas_2019.csv"
FONTE_SUAS_LOCAL = "Censo SUAS 2019 (cópia local, usada porque o cadastro do MDS está fora do ar)"
PAUSA_MDS_S = 600     # depois de uma falha, passa 10 min sem tentar o MDS (cada tentativa demora)
_ESTADO_MDS = {"fora_ate": 0.0}  # num dicionário para os testes conseguirem zerar


# Decorador: "embrulha" a ferramenta num try/except.
def _seguro(funcao):
    """Ferramenta nunca deve quebrar o agente: erro vira uma resposta que o LLM entende."""
    @wraps(funcao)  # mantém nome, docstring e argumentos (o LLM precisa deles)
    def envolvida(*args, **kwargs):
        try:
            return funcao(*args, **kwargs)
        except Exception as erro:
            # Em vez de quebrar, devolve um dicionário de erro que o LLM consegue explicar ao usuário.
            return {"erro": f"dado indisponível no momento ({erro})"}
    return envolvida


# ---------- Funções de apoio (sem @tool) ----------
def _normalizar(texto) -> str:
    """'Mauá' -> 'MAUA': sem acentos, maiúsculas e sem espaços sobrando (para comparar nomes)."""
    sem_acento = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    return " ".join(sem_acento.upper().split())


def _um(valor):
    """O MDS às vezes devolve um campo como lista (["texto"]): ficamos com o primeiro item."""
    if isinstance(valor, list):
        return valor[0] if valor else None
    return valor


def _telefone(numero) -> str | None:
    """'1145550000' -> '(11) 4555-0000'. Se não reconhecer o formato, devolve como veio."""
    digitos = re.sub(r"\D", "", str(numero or ""))
    if len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    return numero or None


def _float(valor) -> float | None:
    try:
        return float(str(valor).replace("\\", "").strip())
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=32)
def _municipios_da_uf(uf: str) -> tuple:
    """Lista (nome, código IBGE) de todas as cidades de uma UF. Guardada em cache: quase nunca muda."""
    dados = get_json(IBGE.format(uf=uf))
    return tuple((m["nome"], int(m["id"])) for m in dados)


def codigo_municipio(municipio: str, uf: str) -> tuple[str, int] | None:
    """Devolve (nome oficial, código de 6 dígitos). Aceita nome ("Mauá") ou código IBGE de 6/7 dígitos."""
    texto = (municipio or "").strip()
    if texto.isdigit() and len(texto) in (6, 7):
        return texto, int(texto[:6])
    alvo = _normalizar(texto)
    for nome, codigo in _municipios_da_uf(uf.strip().upper()):
        if _normalizar(nome) == alvo:
            return nome, codigo // 10  # tira o último dígito (dígito verificador)
    return None


def localizar_cep(cep: str) -> dict | None:
    """CEP -> cidade, UF, código de 6 dígitos, bairro e coordenadas. None se o CEP não existir.

    As coordenadas são opcionais: se a BrasilAPI não tiver (ou cair), ordenamos pelo bairro.
    """
    digitos = re.sub(r"\D", "", cep or "")  # "09321-090" -> "09321090"
    if len(digitos) != 8:
        return None
    dados = get_json(VIACEP.format(cep=digitos))
    if not dados or dados.get("erro") or not dados.get("ibge"):  # CEP inexistente: {"erro": "true"}
        return None
    local = {
        "cep": f"{digitos[:5]}-{digitos[5:]}",
        "cidade": dados.get("localidade"),
        "uf": dados.get("uf"),
        "codigo": int(str(dados["ibge"])[:6]),
        "bairro": dados.get("bairro") or "",
        "lat": None,
        "lon": None,
    }
    try:
        coordenadas = ((get_json(BRASILAPI_CEP.format(cep=digitos)).get("location") or {})
                       .get("coordinates") or {})
        local["lat"] = float(coordenadas["latitude"])
        local["lon"] = float(coordenadas["longitude"])
    except Exception:
        pass
    return local


def distancia_km(lat1, lon1, lat2, lon2) -> float:
    """Distância em linha reta entre dois pontos (fórmula de haversine). Não é o trajeto a pé."""
    r = 6371  # raio da Terra em km
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


# ---------- Busca em cada fonte (todas devolvem o MESMO formato) ----------
def _caps_do_municipio(codigo: int) -> list[dict]:
    """CAPS ativos do município, no CNES (página por página)."""
    brutos = []
    for pagina in range(MAX_PAGINAS):
        params = {"codigo_tipo_unidade": TIPO_CAPS, "codigo_municipio": codigo,
                  "limit": POR_PAGINA, "offset": pagina * POR_PAGINA}
        lote = get_json(CNES, params).get("estabelecimentos") or []
        brutos.extend(lote)
        if len(lote) < POR_PAGINA:  # página incompleta = acabou
            break
    unidades = []
    for e in brutos:
        if e.get("codigo_motivo_desabilitacao_estabelecimento"):  # desativado: fica de fora
            continue
        rua = e.get("endereco_estabelecimento") or ""
        unidades.append({
            "nome": e.get("nome_fantasia"),
            "endereco": f"{rua}, {e.get('numero_estabelecimento') or 's/n'}".strip(", "),
            "bairro": e.get("bairro_estabelecimento"),
            "cep": e.get("codigo_cep_estabelecimento"),
            "telefone": e.get("numero_telefone_estabelecimento"),
            "email": e.get("endereco_email_estabelecimento"),
            "horario": e.get("descricao_turno_atendimento"),
            "atualizado_em": e.get("data_atualizacao"),
            "_lat": _float(e.get("latitude_estabelecimento_decimo_grau")),
            "_lon": _float(e.get("longitude_estabelecimento_decimo_grau")),
        })
    return unidades


def _suas_do_municipio(codigo: int, tipo: str) -> list[dict]:
    """CRAS ou CREAS do município, no cadastro de equipamentos do MDS."""
    params = {"q": "*:*", "fq": [f"ibge:{codigo}", f"tipo_equipamento:{tipo}"],
              "wt": "json", "rows": 300, "fl": CAMPOS_MDS}
    docs = (get_json(MDS, params).get("response") or {}).get("docs") or []
    unidades = []
    for d in docs:
        d = {chave: _um(valor) for chave, valor in d.items()}
        lat, lon = (str(d.get("georef_location") or "").split(",") + ["", ""])[:2]
        rua = d.get("endereco") or ""
        unidades.append({
            "nome": d.get("nome"),
            "endereco": f"{rua}, {d.get('numero') or 's/n'}".strip(", "),
            "complemento": " - ".join(x for x in (d.get("complemento"), d.get("referencia")) if x) or None,
            "bairro": d.get("bairro"),
            "cep": d.get("cep"),
            "telefone": _telefone(d.get("telefone")),
            "email": d.get("email"),
            "atualizado_em": str(d.get("data_atualizacao") or "")[:10] or None,
            "_lat": _float(lat),
            "_lon": _float(lon),
        })
    return unidades


@lru_cache(maxsize=1)
def _base_suas_local() -> dict[tuple[str, str], list[dict]]:
    """Lê a cópia local uma vez só e agrupa por (código da cidade, tipo)."""
    grupos: dict[tuple[str, str], list[dict]] = {}
    with open(BASE_SUAS_LOCAL, encoding="utf-8") as arquivo:
        for linha in csv.DictReader(arquivo):
            grupos.setdefault((linha["codigo_ibge"], linha["tipo"]), []).append(linha)
    return grupos


def _suas_da_reserva(codigo: int, tipo: str) -> list[dict]:
    """CRAS ou CREAS do município na cópia local do Censo SUAS 2019."""
    return [{
        "nome": u["nome"],
        "endereco": u["endereco"],
        "bairro": u["bairro"] or None,
        "cep": u["cep"] or None,
        "telefone": _telefone(u["telefone"]),
        "_lat": _float(u["lat"]),
        "_lon": _float(u["lon"]),
    } for u in _base_suas_local().get((str(codigo), tipo), [])]


def _suas_com_reserva(codigo: int, tipo: str) -> tuple[list[dict], bool]:
    """Tenta o MDS; se ele falhar (ou falhou há pouco), usa a cópia local. Devolve (unidades, usou_reserva)."""
    if time.time() >= _ESTADO_MDS["fora_ate"]:
        try:
            return _suas_do_municipio(codigo, tipo), False
        except Exception as erro:
            print(f"[unidades] MDS fora do ar ({erro}); usando a cópia local por {PAUSA_MDS_S // 60} min")
            _ESTADO_MDS["fora_ate"] = time.time() + PAUSA_MDS_S
    return _suas_da_reserva(codigo, tipo), True


def _modalidade_confere(nome: str, modalidade: str) -> bool:
    """Tipo de CAPS pelo nome (o CNES não tem um campo só para isso)."""
    palavras = _normalizar(nome).replace("-", " ").split()
    if modalidade == "AD":   # álcool e outras drogas
        return "AD" in palavras or "ALCOOL" in palavras
    if modalidade == "IJ":   # infantojuvenil (crianças e adolescentes)
        return any(p in palavras for p in ("IJ", "INFANTOJUVENIL", "INFANTIL", "INFANTO"))
    return True


def _ordenar_por_proximidade(unidades: list[dict], local: dict) -> tuple[list[dict], str]:
    """Põe as unidades mais perto do CEP primeiro. Devolve a lista e o critério usado."""
    if local["lat"] is not None:
        for u in unidades:
            if u["_lat"] is not None and u["_lon"] is not None:
                u["distancia_km"] = distancia_km(local["lat"], local["lon"], u["_lat"], u["_lon"])
        # Quem não tem coordenada no cadastro vai para o fim da lista.
        ordenadas = sorted(unidades, key=lambda u: u.get("distancia_km", float("inf")))
        return ordenadas, "distância em linha reta a partir do CEP"
    mesmo_bairro = _normalizar(local["bairro"])
    ordenadas = sorted(unidades, key=lambda u: _normalizar(u.get("bairro")) != mesmo_bairro)
    return ordenadas, "mesmo bairro primeiro (sem coordenadas do CEP; não é por distância)"


def _limpar(u: dict) -> dict:
    """Tira os campos internos (_lat, _lon) e os vazios, para não gastar tokens."""
    return {k: v for k, v in u.items() if not k.startswith("_") and v not in (None, "")}


# ---------- Partes comuns às duas ferramentas (sem @tool) ----------
def _onde(cep: str, municipio: str, uf: str) -> dict:
    """Descobre a cidade (e, com CEP, o ponto de partida). Devolve {"erro": ...} se não der."""
    # Robustez: se o modelo mandou o CEP no lugar da cidade, tratamos como CEP.
    if not cep and len(re.sub(r"\D", "", municipio or "")) == 8:
        cep, municipio = municipio, ""
    if cep:
        local = localizar_cep(cep)
        if not local:
            return {"erro": f"não encontrei o CEP '{cep}'. Confira os 8 números do CEP "
                            "ou informe a cidade e o estado.", "fonte": "ViaCEP"}
        return {"local": local, "cidade": local["cidade"], "uf": local["uf"], "codigo": local["codigo"]}
    if not municipio or not uf:
        return {"erro": "faltou a cidade e o estado (ou o CEP). Pergunte ao usuário."}
    achado = codigo_municipio(municipio, uf)
    if not achado:
        return {"erro": f"não encontrei a cidade '{municipio}' no estado '{uf}'. "
                        "Confira o nome e a sigla do estado.", "fonte": "IBGE"}
    return {"local": None, "cidade": achado[0], "uf": uf.strip().upper(), "codigo": achado[1]}


def _resposta(tipo: str, unidades: list[dict], onde: dict, fonte: str, aviso: str, bairro: str = "") -> dict:
    """Filtra pelo bairro, ordena pela distância (com CEP) e devolve só os campos úteis e a fonte."""
    if bairro:
        unidades = [u for u in unidades if _normalizar(bairro) in _normalizar(u.get("bairro"))]
    resposta = {"tipo": tipo, "municipio": f"{onde['cidade']}/{onde['uf']}"}
    local = onde["local"]
    if local:
        resposta["referencia"] = f"CEP {local['cep']}, bairro {local['bairro'] or 'não informado'}"
    if not unidades:
        return {**resposta, "total": 0, "unidades": [],
                "aviso": f"Nenhum {tipo} encontrado com esses filtros. A pessoa pode procurar a "
                         "prefeitura (Secretaria de Saúde ou de Assistência Social) da cidade.",
                "fonte": fonte}
    limite = MAX_RESULTADOS
    if local:
        unidades, criterio = _ordenar_por_proximidade(unidades, local)
        resposta["ordenado_por"] = criterio
        limite = MAIS_PROXIMOS
    return {**resposta, "total": len(unidades),
            "unidades": [_limpar(u) for u in unidades[:limite]],
            "aviso": aviso + " Copie nomes, endereços e telefones exatamente como estão aqui.",
            "fonte": fonte}


# ---------- As ferramentas ----------
# @tool transforma a função em ferramenta que o LLM pode pedir; @_seguro protege contra erros.
@tool
@_seguro
def buscar_caps(cep: str = "", municipio: str = "", uf: str = "", modalidade: str = "",
                bairro: str = "") -> dict:
    """Encontra os CAPS (Centros de Atenção Psicossocial, do SUS) de uma cidade, com nome, endereço,
    bairro, telefone, horário de atendimento e, com CEP, a distância. Dados oficiais do CNES.
    Use quando a pessoa quiser saber ONDE fica um CAPS: saúde mental, sofrimento psíquico intenso,
    crise, uso de álcool ou outras drogas. NÃO use para explicar o que é o CAPS.
    Localização, informe UMA opção:
      cep: se o usuário deu um CEP, passe SÓ o cep (ex.: "09321-090") e deixe municipio e uf vazios.
        A ferramenta descobre a cidade e ordena do CAPS mais perto para o mais longe.
      municipio + uf: nome da cidade (ex.: "Mauá") e sigla do estado com 2 letras (ex.: "SP").
    Se o usuário não deu nem CEP nem cidade, pergunte antes de chamar.
    modalidade: opcional. "AD" = álcool e drogas; "IJ" = crianças e adolescentes (CAPSi).
    bairro: opcional, filtra pelo bairro, ex.: "Centro"."""
    onde = _onde(cep, municipio, uf)
    if "erro" in onde:
        return onde
    unidades = _caps_do_municipio(onde["codigo"])
    modalidade = (modalidade or "").strip().upper()
    unidades = [u for u in unidades if _modalidade_confere(u["nome"] or "", modalidade)]
    aviso = "Dados do cadastro oficial; horários e telefones podem mudar. Recomende ligar antes de ir."
    return _resposta("CAPS", unidades, onde, FONTES["CAPS"], aviso, bairro)


@tool
@_seguro
def buscar_cras_creas(tipo: str, cep: str = "", municipio: str = "", uf: str = "",
                      bairro: str = "") -> dict:
    """Encontra os CRAS ou os CREAS de uma cidade, com nome, endereço, bairro, telefone e, com CEP,
    a distância. Dados do cadastro do SUAS (Ministério do Desenvolvimento e Assistência Social).
    Use quando a pessoa quiser saber ONDE fica um CRAS ou um CREAS. NÃO use para explicar os serviços.
    tipo: obrigatório, um destes:
      "CRAS"  = assistência social básica (Cadastro Único, Bolsa Família, BPC, orientação à família);
      "CREAS" = violação de direitos (violência, abuso, negligência, abandono, trabalho infantil).
    Para CAPS (saúde mental), use buscar_caps.
    Localização, informe UMA opção:
      cep: se o usuário deu um CEP, passe SÓ o cep (ex.: "09321-090") e deixe municipio e uf vazios.
        A ferramenta descobre a cidade e ordena da unidade mais perto para a mais longe.
      municipio + uf: nome da cidade (ex.: "Mauá") e sigla do estado com 2 letras (ex.: "SP").
    Se o usuário não deu nem CEP nem cidade, pergunte antes de chamar.
    bairro: opcional, filtra pelo bairro, ex.: "Centro"."""
    tipo = _normalizar(tipo).replace(" ", "")
    if tipo not in ("CRAS", "CREAS"):
        return {"erro": f"tipo '{tipo}' inválido. Use \"CRAS\" ou \"CREAS\" (para CAPS, use buscar_caps)."}
    onde = _onde(cep, municipio, uf)
    if "erro" in onde:
        return onde
    unidades, usou_reserva = _suas_com_reserva(onde["codigo"], tipo)
    fonte = FONTE_SUAS_LOCAL if usou_reserva else FONTES[tipo]
    if usou_reserva and not unidades:
        # Nem o MDS nem a cópia local têm a cidade: indicamos quem pode informar, sem inventar.
        return {"erro": f"o cadastro de {tipo} do MDS está fora do ar e a cópia local não tem "
                        f"{tipo} para {onde['cidade']}/{onde['uf']}.",
                "alternativa": "A pessoa pode ligar para a prefeitura (Secretaria de Assistência "
                               f"Social) ou procurar no mapa oficial do governo ({MOPS}), "
                               "quando ele voltar ao ar.",
                "fonte": fonte}
    if usou_reserva:
        aviso = ("O cadastro do MDS está fora do ar. Estes dados são do Censo SUAS de 2019 e podem estar "
                 "desatualizados: diga isso à pessoa e recomende ligar antes de ir ou confirmar com a prefeitura.")
    else:
        aviso = "Dados do cadastro oficial; horários e telefones podem mudar. Recomende ligar antes de ir."
    if tipo == "CRAS":
        aviso += (" Cada CRAS atende uma área (território): o mais perto em linha reta pode não ser "
                  "o que atende o endereço da pessoa. Ela deve confirmar por telefone.")
    return _resposta(tipo, unidades, onde, fonte, aviso, bairro)


# Lista com as ferramentas do PASIbot; é ela que entregamos ao agente.
FERRAMENTAS_PASI = [buscar_caps, buscar_cras_creas]


if __name__ == "__main__":
    # python -m app.tools.unidades  -> testa as APIs sem LLM (olhe os dados antes de entregar ao LLM)
    from pprint import pprint
    pprint(buscar_caps.invoke({"municipio": "São Paulo", "uf": "SP"}))      # exemplo da professora (355030)
    pprint(buscar_caps.invoke({"cep": "09321-090"}))                        # CEP de Mauá
    pprint(buscar_caps.invoke({"cep": "02036-021", "modalidade": "AD"}))    # CAPS AD em São Paulo
    pprint(buscar_cras_creas.invoke({"tipo": "CRAS", "cep": "09321-090"}))
    pprint(buscar_cras_creas.invoke({"tipo": "CREAS", "municipio": "Mauá", "uf": "SP"}))
