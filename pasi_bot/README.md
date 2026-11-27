# PASIBot

Assistente do [PASI](https://pasi-landing-page.onrender.com) (Plataforma de Atendimento de Sistemas Integrados), projeto de TCC da Fatec Mauá. Ele orienta sobre os serviços públicos de assistência social e saúde mental (CRAS, CREAS e CAPS), ajuda a pessoa a entender qual procurar e encontra a unidade mais perto dela. Este projeto está sendo desenvolvido passo a passo como parte das aulas.

## Etapa atual

Na Aula 4, o PASIBot virou um **agente com ferramentas**: em vez de inventar endereços, ele consulta dados reais.

| Ferramenta | O que busca | Fonte |
|---|---|---|
| `buscar_caps` | CAPS de uma cidade ou perto de um CEP | CNES / Ministério da Saúde (API pública, sem token) |
| `buscar_cras_creas` | CRAS ou CREAS de uma cidade ou perto de um CEP | Cadastro do SUAS (MDS). Enquanto o MDS estiver fora do ar, usa a cópia do Censo SUAS 2019 em `app/data/` e avisa que pode estar desatualizada |

Para testar as ferramentas sozinhas, sem o LLM:

```powershell
python -m app.tools.unidades
```

Próxima etapa (Aula 5, RAG): textos oficiais do gov.br na pasta `documentos/`, explicando o que é cada serviço, quem pode ser atendido e como acessar.

## Requisitos

- Python 3.12
- Uma chave de API da Groq

## Como configurar no Windows

Abra o repositório do PASI no VS Code e, no terminal integrado, entre na pasta do bot. Execute os comandos abaixo, um de cada vez:

```powershell
cd pasi_bot
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Depois, abra o arquivo `.env` no VS Code e preencha `GROQ_API_KEY` com sua chave da Groq. Não compartilhe essa chave e não a coloque neste README.

## Como executar

Todos os comandos abaixo rodam dentro de `pasi_bot`, com o ambiente virtual ativado e o `.env` configurado. A memória das conversas fica no MongoDB: localmente, use um MongoDB em `mongodb://localhost:27017` ou aponte o `MONGO_URL` para o Atlas.

### Conversar pelo terminal

```powershell
python -m scripts.chat_terminal
```

Digite `sair` para encerrar a conversa.

### Testar com o chat da landing page

O front do PASIBot é a assistente da landing page (`landing-page/src/components/Assistente/`). Para usá-la com a API local:

1. Suba a API:

   ```powershell
   uvicorn app.main:app --reload
   ```

   A documentação fica em http://127.0.0.1:8000/docs.

2. Crie o arquivo `landing-page/.env.local` com:

   ```
   VITE_ASSISTENTE_API_URL=http://127.0.0.1:8000
   ```

3. Em outro terminal, na pasta `landing-page`, rode `npm run dev` e abra o endereço mostrado.

## Como executar os testes

Com o ambiente virtual ativado, rode:

```powershell
pytest -v
```

## Links do projeto

| O quê | Link |
|---|---|
| Chat publicado (landing page do PASI) | https://pasi-landing-page.onrender.com |
| API publicada (Render) | https://pasi-bot-api.onrender.com |
| Documentação da API | https://pasi-bot-api.onrender.com/docs |

No plano gratuito, a API "dorme" depois de um tempo sem uso: a primeira pergunta pode demorar cerca de 1 minuto.

## Publicação

O serviço `pasi-bot-api` está declarado no `render.yaml` da raiz do repositório, junto com os outros serviços do PASI. Ele usa `rootDir: pasi_bot` e só é publicado de novo quando algo dentro de `pasi_bot/` muda. As chaves (`GROQ_API_KEY`, `MONGO_URL` e as do Langfuse) são digitadas no painel do Render e não ficam no repositório.

## Segurança

O arquivo `.env` contém chaves privadas e não deve ser enviado ao GitHub. O arquivo `.env.example` contém apenas o modelo das configurações e pode ser publicado.

## Próximas etapas

Este projeto será ampliado nas aulas seguintes.
