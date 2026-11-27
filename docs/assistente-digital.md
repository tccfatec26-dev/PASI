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

# Assistente virtual no app do paciente

O app (`apps/mobile`) tem o seu próprio assistente, feito para quem já está logado. Ele aparece
no botão **Ajuda** da tela Meus Atendimentos e no item **Assistente virtual** do menu lateral.

## O que ele faz

| Parte | Onde roda | Arquivo |
|---|---|---|
| Cumprimenta pelo primeiro nome do paciente logado (`usuario.nome`) | App | `src/screens/AssistenteScreen.tsx` |
| Avisa se algum atendimento tem formulários pendentes e leva direto para eles | App (lista de atendimentos da API do PASI) | `AssistenteScreen.tsx` |
| Dúvidas sobre o app: responder formulário, situações, rascunho, acessibilidade, avisos, perfil | App, com texto fixo e revisado | `src/assistente/conteudo.ts` |
| Situação de risco (ex.: "quero morrer"): mostra 192 e 188 antes de tudo | App | `conteudo.ts` |
| Outras perguntas em texto livre | API do PASIBot (`POST /chat`) | `src/services/assistente.ts` |
| Falar com um atendente | API do PASI (`POST /api/assistente/atendente`) | `apps/api/src/assistente/` |

No app não existe bloqueio de CORS, então a lista de endereços liberados no `pasi_bot/app/main.py`
não se aplica a ele. Nenhum dado pessoal vai para o PASIBot: o app manda só o texto digitado e uma
sessão aleatória. A URL vem de `EXPO_PUBLIC_ASSISTENTE_API_URL` (sem ela, usa a mesma URL padrão da
landing, `https://pasi-bot-api.onrender.com`). Para testar com o bot de dev, defina essa variável
com a URL do `pasi-bot-api-dev`.

## Falar com um atendente

O paciente escolhe o atendimento (o app sugere o que tem formulários pendentes), pode escrever
uma mensagem e toca em **Chamar atendente**. A API então:

1. manda um **e-mail para a unidade do atendimento** (`unidade_atendimento.email`), com o nome e
   o contato do paciente, o protocolo, o assunto, a mensagem e as últimas mensagens da conversa
   com o assistente. O **Responder** do e-mail vai direto para o e-mail do paciente;
2. grava um **aviso no sino** (tipo 4, "Pedido de atendimento") para o profissional que criou o
   atendimento (`atendimento.id_usuario_cad`). O aviso abre o atendimento no painel.

Cada parte pode falhar sozinha (unidade sem e-mail, Brevo fora do ar). A resposta diz o que deu
certo, e o app mostra o botão **Ligar para a unidade** quando ela tem telefone. Para um toque
repetido não lotar a caixa da unidade, o mesmo paciente só pode pedir de novo para o mesmo
atendimento depois de 10 minutos.

### Antes de publicar

- Rodar `apps/api/prisma/sql/2026-11-26_pedido_atendente.sql` no Neon (cria o tipo de
  notificação 4). Sem ele, o e-mail sai, mas o aviso do sino não é gravado.
- Conferir se as unidades têm e-mail cadastrado no painel (Gestão > Unidades).
- Não há mudança nativa no app: vai por atualização automática, sem APK novo.
