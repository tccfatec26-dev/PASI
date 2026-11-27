# app/utils/http.py
"""Chamadas HTTP com tempo limite e cabeçalhos padrão."""
import requests


def get_json(url: str, params: dict | None = None):
    # User-Agent identifica quem está chamando (algumas APIs recusam pedidos sem ele).
    headers = {"User-Agent": "PASIbot-FATEC/1.0", "Accept": "application/json"}
    # timeout=15: desiste em 15 s se a API não responder, em vez de travar o chat.
    resposta = requests.get(url, params=params, headers=headers, timeout=15)
    resposta.raise_for_status()  # erro HTTP (404, 500...) vira exceção
    return resposta.json()  # converte o JSON da resposta em dicionário/lista do Python
