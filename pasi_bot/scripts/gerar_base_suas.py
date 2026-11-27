"""Gera app/data/unidades_suas_2019.csv, a cópia local de CRAS e CREAS usada quando o MDS cai.

Origem: Censo SUAS 2019 geolocalizado por Lucas Warwar
(https://github.com/lucaswarwar/assistencia_social, arquivo "data/csv/centros_2019 - centros_2019.csv", o que tem coordenadas para todas as unidades).
Citação pedida pelo autor: Warwar, L. (2020). Geolocalização dos centros de Assistência Social do SUAS.

Uso:  python -m scripts.gerar_base_suas "caminho/para/centros_2019 - centros_2019.csv"
"""
import csv
import re
import sys
from pathlib import Path

DESTINO = Path(__file__).parent.parent / "app" / "data" / "unidades_suas_2019.csv"
CAMPOS = ["codigo_ibge", "tipo", "nome", "endereco", "bairro", "cep", "telefone", "lat", "lon"]


def _corrigir_palavra(palavra: str) -> str:
    if "Ã" not in palavra and "Â" not in palavra:
        return palavra
    for codificacao in ("cp1252", "latin-1"):
        try:
            return palavra.encode(codificacao).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return palavra  # 'JOÃO' é acento correto: não vira UTF-8 válido e fica como está


def corrigir_acentos(texto: str) -> str:
    """Parte da base veio com acentos corrompidos ('AVARÃ‰' em vez de 'AVARÉ').

    A correção é palavra por palavra: na mesma linha pode haver acentos certos ('Mauá').
    """
    return " ".join(_corrigir_palavra(p) for p in texto.split(" "))


def separar_endereco(endereco: str) -> tuple[str, str, str]:
    """'Rua X, 10 - Bairro, Cidade - UF, 9321375' -> ('Rua X, 10', 'Bairro', '09321-375')."""
    partes = [p.strip() for p in endereco.split(" - ")]
    if len(partes) < 3:
        return endereco.strip(), "", ""
    rua = " - ".join(partes[:-2])
    bairro = partes[-2].rsplit(",", 1)[0].strip()
    digitos = re.sub(r"\D", "", partes[-1].rsplit(",", 1)[-1]).zfill(8)
    cep = f"{digitos[:5]}-{digitos[5:]}" if len(digitos) == 8 else ""
    return rua, bairro, cep


def main(origem: str):
    linhas = []
    with open(origem, encoding="utf-8") as arquivo:
        for r in csv.DictReader(arquivo):
            if r["tipo_centro"] not in ("CRAS", "CREAS"):
                continue
            try:  # sem coordenada não dá para ordenar por distância: fica de fora
                lat, lon = float(r["lat"]), float(r["lon"])
            except ValueError:
                continue
            rua, bairro, cep = separar_endereco(corrigir_acentos(r["endereco"]))
            linhas.append({
                "codigo_ibge": r["cod_ibge"][:6],  # mesmo código de 6 dígitos que o CNES e o MDS usam
                "tipo": r["tipo_centro"],
                "nome": corrigir_acentos(r["nome_centro"]).strip(),
                "endereco": rua,
                "bairro": bairro,
                "cep": cep,
                "telefone": re.sub(r"\D", "", r["telefone"]),
                "lat": round(lat, 6),
                "lon": round(lon, 6),
            })
    linhas.sort(key=lambda u: (u["codigo_ibge"], u["tipo"], u["nome"]))
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=CAMPOS)
        escritor.writeheader()
        escritor.writerows(linhas)
    print(f"{len(linhas)} unidades gravadas em {DESTINO}")


if __name__ == "__main__":
    main(sys.argv[1])
