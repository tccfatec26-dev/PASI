# Assistente digital na landing page

Integração do PASIBot na landing page, seguindo o design aprovado no canvas.
O código da API fica em `pasi_bot/` (ver o [README do bot](../pasi_bot/README.md)). Ele veio do
repositório das aulas de PLN ([EllenEufrasio/chat_com_alunos](https://github.com/EllenEufrasio/chat_com_alunos)).

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
Sem essa variável, o código usa `https://pasi-bot-api.onrender.com`.

Para rodar a landing com a API local (veja no README do bot como subir a API):

```bash
# landing-page/.env.local
VITE_ASSISTENTE_API_URL=http://127.0.0.1:8000
```

O CORS da API (`pasi_bot/app/main.py`) libera a landing de produção, a de dev e o `localhost`
em qualquer porta. Uma landing publicada em outro endereço precisa entrar nessa lista.

## Avaliação do repositório do chat

Pontos fortes:

- O contrato da API é simples e estável: `POST /chat` recebe `{ mensagem, sessao, usuario }` e
  devolve `{ resposta, agente, fontes }`.
- O prompt de sistema já segue as regras do PASI: não inventar endereços, priorizar 190, 192,
  188, 180 e 100 em situações de risco, e não pedir dados pessoais.
- A ferramenta `buscar_unidade` usa dados oficiais e ordena as unidades por distância a partir
  do CEP.

Pontos de atenção:

1. **CORS:** resolvido. A API libera a landing de produção, a de dev e o Vite local.
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
6. **Restos de outros projetos:** resolvido no README e no Render: o serviço agora é o
   `pasi-bot-api`. O perfil do usuário (`/usuarios/{usuario}/perfil`) ainda tem campos do FinBot
   das aulas (`objetivo`, `experiencia`).
