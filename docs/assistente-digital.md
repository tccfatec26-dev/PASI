# Assistente digital na landing page

Integração do PASIBot ([EllenEufrasio/chat_com_alunos](https://github.com/EllenEufrasio/chat_com_alunos))
na landing page, seguindo o design aprovado no canvas.

## Como funciona

O componente fica em `landing-page/src/components/Assistente/` e aparece em todas as páginas
como um botão fixo no **canto inferior esquerdo**. O lado direito já é ocupado pelo VLibras.

Ele funciona em modo híbrido:

| Parte | Onde roda | Por quê |
|---|---|---|
| Triagem por botões ("Benefícios", "Violência", "Saúde mental", "Não sei") | No navegador | Responde na hora, mesmo com a API dormindo no Render |
| Cartões do CRAS, CREAS e CAPS, com telefones de emergência | No navegador | Texto revisado e fixo, sem depender da IA |
| Perguntas em texto livre | API do PASIBot (`POST /chat`) | A IA conversa e explica |
| Busca pelo CEP | API do PASIBot | A ferramenta `buscar_unidade` consulta CNES, MDS e ViaCEP com dados reais |

Se a API não responder, a assistente avisa a pessoa e segue com a triagem por palavras-chave.
Na busca por CEP, ela indica o mapa oficial do MDS (MOPS) e um link para o mapa.

Arquivos:

- `Assistente.tsx`: o componente, com o painel, as mensagens e o fluxo.
- `servicos.ts`: os textos dos serviços, as opções rápidas e a triagem por palavras.
- `api.ts`: as chamadas à API e a sessão da conversa (uma por aba, guardada no `sessionStorage`).
- `TextoFormatado.tsx`: mostra o markdown da IA (negrito, listas e links) sem usar `innerHTML`.

### Configuração

A URL da API vem de `VITE_ASSISTENTE_API_URL`, já declarada no `render.yaml`.
Sem essa variável, o código usa `https://finbot-api-rpj9.onrender.com`.

Para rodar localmente com a API local:

```bash
# landing-page/.env.local
VITE_ASSISTENTE_API_URL=http://127.0.0.1:8000
```

## ⚠️ Pendência no repositório do chat: liberar CORS

Testado em 25/11/2026: a API responde normalmente, mas o navegador **bloqueia** as chamadas
feitas a partir de `https://pasi-landing-page.onrender.com`, porque a API não envia o cabeçalho
`Access-Control-Allow-Origin`. Enquanto isso não for corrigido, a landing usa só o modo offline
(botões e cartões funcionam; texto livre e busca por CEP mostram o aviso de indisponível).

A correção vai no `app/main.py` do `chat_com_alunos`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rotas import router

app = FastAPI(title="PASIBot API", description="Assistente do PASI — FATEC / PLN")

# Libera o navegador da landing page (e o Vite local) para chamar a API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pasi-landing-page.onrender.com",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(router)
```

Depois do deploy no Render, abrir a landing, enviar uma pergunta no chat e conferir que a
resposta chega sem erro de CORS no console do navegador.

## Avaliação do repositório do chat

Pontos fortes:

- O contrato da API é simples e estável: `POST /chat` recebe `{ mensagem, sessao, usuario }` e
  devolve `{ resposta, agente, fontes }`.
- O prompt de sistema já segue as regras do PASI: não inventar endereços, priorizar 190, 192,
  188, 180 e 100 em situações de risco, e não pedir dados pessoais.
- A ferramenta `buscar_unidade` usa dados oficiais e ordena as unidades por distância a partir
  do CEP.

Pontos de atenção:

1. **CORS** (acima). Bloqueia a integração.
2. **Tempo de resposta:** cada resposta leva de 8 a 11 segundos, e a primeira depois que a API
   dorme pode levar perto de 1 minuto. A landing chama `/saude` ao abrir o chat para acordar a
   API e avisa a pessoa quando a resposta demora.
3. **O MDS às vezes não responde:** no teste, a busca de CRAS pelo CEP voltou com "cadastro do
   MDS não respondeu". A IA tratou bem e indicou o mapa oficial, e a landing também mostra o link
   do mapa.
4. **Resposta só em texto:** a API devolve as unidades dentro do texto. Para mostrar cartões com
   nome, endereço e botão "Ligar", como no design, a API precisaria devolver também os dados
   estruturados, por exemplo um campo `unidades` na resposta de `/chat`.
5. **Endpoint público sem limite de uso:** qualquer site pode chamar `/chat` e gastar a cota da
   Groq. Vale limitar por IP (por exemplo com `slowapi`) antes de divulgar.
6. **Restos de outros projetos:** o `README.md` tem marcadores de conflito de merge
   (`<<<<<<< HEAD`) e ainda fala em "investimentos". O título da API e o serviço no Render ainda
   se chamam "FinBot".
