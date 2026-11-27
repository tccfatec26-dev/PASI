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
7. **Resposta atrasada depois de "Recomeçar": corrigido no código, falta conferir no aparelho.**
   Antes, se a pessoa recomeçava a conversa enquanto a IA ainda respondia, a resposta da pergunta
   anterior aparecia na conversa nova. Agora a landing e o app usam o mesmo módulo,
   `conversa.ts` (`landing-page/src/components/Assistente/` e `apps/mobile/src/assistente/`), que:
   - dá um número a cada conversa e guarda, em cada pergunta, o número e a sessão em que ela foi feita;
   - ao recomeçar, cancela a requisição pendente (`AbortController`, junto com o tempo limite de 90 s);
   - descarta a resposta que chegar mesmo assim, porque ela não pertence à conversa atual;
   - zera o "escrevendo…", o aviso de demora, o modo CEP e o serviço escolhido, e cria uma sessão nova
     na API, então a conversa nova começa sem histórico.

   **Inatividade:** depois de 15 minutos sem ação da pessoa, a conversa é encerrada com a mensagem
   "Atendimento finalizado por inatividade." e o botão "Começar nova conversa". Mandar uma mensagem
   também abre uma conversa nova. A landing guarda a hora da última atividade no `sessionStorage`:
   ao recarregar a página depois de 15 minutos, a sessão antiga não é reaproveitada. Isso não mexe
   em banco nenhum: o histórico antigo continua no MongoDB do bot, só não é mais usado.

   Testes: `npm test` na landing (4 testes) e no app (6 testes de `conversa.ts`).

# Assistente digital no app do paciente

O app (`apps/mobile`) usa a mesma assistente da landing page, com a mesma API do PASIBot. Ela
abre pelo botão **Ajuda** da tela Meus Atendimentos e pelo item **Assistente virtual** do menu
lateral. O atendimento é feito só pelo robô: o app não chama atendente humano nem grava nada no
banco.

| Landing (`landing-page/src/components/Assistente/`) | App (`apps/mobile/src/`) |
|---|---|
| `api.ts` (POST `/chat`, `/saude`, 90 s de limite) | `services/assistente.ts` (mesma chamada, `usuario: app-pasi`) |
| `servicos.ts` (CRAS/CREAS/CAPS, triagem, CEP, risco) | `assistente/servicos.ts` (igual, mais "Como usar o aplicativo") |
| `TextoFormatado.tsx` (markdown, tabelas em cartões, telefones) | `assistente/TextoFormatado.tsx` (versão React Native) |
| `Assistente.tsx` (conversa) | `screens/AssistenteScreen.tsx` (mesma conversa, em tela cheia) |

Diferenças no app:
- cumprimenta pelo primeiro nome do paciente logado;
- a opção **Como usar o aplicativo** responde dúvidas do app com texto fixo
  (`assistente/conteudo.ts`);
- "Como começar a triagem" explica os formulários em Meus Atendimentos, em vez de pedir para
  baixar o app;
- cada resposta tem **Ouvir** (leitura em voz alta) e as cores seguem o tema escolhido (claro,
  escuro, alto contraste ou preto e branco).

A URL vem de `EXPO_PUBLIC_ASSISTENTE_API_URL` (sem ela, `https://pasi-bot-api.onrender.com`).
Nenhum dado pessoal vai para o PASIBot: só o texto digitado e uma sessão aleatória. Não há
mudança nativa: vai por atualização automática, sem APK novo.

A função "Falar com um atendente" (e-mail para a unidade e aviso ao profissional) foi retirada
da API, do painel e do app: o grupo decidiu não implementar atendimento humano agora. Se o script
`2026-11-26_pedido_atendente.sql` chegou a ser rodado no Neon, a linha 4 de `tipo_notificacao`
pode ficar (não atrapalha) ou ser apagada com
`DELETE FROM tipo_notificacao WHERE id_tipo_notificacao = 4;`.

## Unidade da conversa (vínculo com a unidade de atendimento)

No app, a conversa fica ligada à unidade em que o paciente **já é atendido**, para a assistente
responder com esse contexto. O vínculo vale durante a conversa e some ao recomeçar ou por
inatividade. Ele **não é gravado** no banco do PASI e nenhuma tabela foi criada ou alterada.

**De onde vêm as unidades.** Só dos atendimentos do próprio paciente (`GET /atendimentos`, campo
`unidade_atendimento`), com o tipo de cada unidade vindo de `GET /apoio/unidades`
(`tipo_unidade_atendimento.nome`, por sigla ou por extenso). Atendimentos inativos não contam.
Uma unidade com tipo que não é CRAS, CREAS nem CAPS nunca é escolhida pelo tipo. Nenhuma unidade
é inventada.

**Critérios que permitem o vínculo** (`apps/mobile/src/assistente/vinculo.ts`):

| Critério | Como acontece | Resultado |
|---|---|---|
| Dúvida em um formulário | Botão de ajuda (?) no cabeçalho da tela do formulário, ou "Tenho dúvida nesses formulários" no chat | A unidade daquele atendimento |
| Serviço escolhido nos botões | "Benefícios…", "Violência…", "Saúde mental…" ou a triagem | A unidade do paciente desse tipo |
| Serviço identificado pela IA | O PASIBot chama a ferramenta `indicar_servico`, ou a pessoa pede unidades de um serviço | A unidade do paciente desse tipo |
| Escolha da pessoa | Quando há mais de uma unidade do mesmo tipo, a assistente pergunta qual | A unidade escolhida |

**Quando não dá para vincular com segurança:**
- a IA não identificou o serviço: nada é vinculado, e a conversa segue com perguntas ou com a triagem por botões;
- a API do bot está fora do ar e o serviço saiu da triagem por palavras: a assistente mostra o
  serviço, mas pergunta "É isso?" antes de vincular;
- o paciente não é atendido em nenhuma unidade daquele tipo: nada é vinculado, e a assistente
  oferece a busca da unidade pública mais próxima pelo CEP;
- os dados do paciente não carregaram: nada é vinculado.

A unidade aparece numa faixa abaixo do cabeçalho ("Unidade desta conversa"), com o botão
**Remover**. Quando o vínculo muda, a pergunta seguinte leva o contexto para a IA, no mesmo formato
que o app já usava: `(Contexto do atendimento: a pessoa já é atendida na unidade CRAS Centro (CRAS), Mauá/SP.)`.
Vai só o nome, o tipo e a cidade da unidade, nenhum dado pessoal.

**No PASIBot** (`pasi_bot/app/tools/triagem.py`): nova ferramenta `indicar_servico` e novo campo
opcional `servico_indicado` na resposta de `POST /chat`:

```json
{ "resposta": "...", "agente": "pasibot", "fontes": [],
  "servico_indicado": { "servico": "CREAS", "origem": "ia", "motivo": "relato de violência em casa" } }
```

`origem` é `ia` (a IA chamou `indicar_servico`) ou `busca` (a IA chamou `buscar_caps` ou
`buscar_cras_creas`, porque a pessoa pediu unidades desse serviço). O valor sai do histórico da
sessão no checkpointer, então continua valendo nas perguntas seguintes até mudar. A landing, que
não tem login, só usa o campo como serviço padrão da busca por CEP. Clientes antigos ignoram o campo.

Para publicar:
- o prompt `sistema.md` ganhou as regras da ferramenta. Se o Langfuse estiver ativo, rode
  `python -m scripts.publicar_prompts` para a versão de produção receber o texto novo;
- quando a IA chama `indicar_servico`, há uma volta a mais no loop de ferramentas, e a resposta
  daquele turno demora alguns segundos a mais.

Testes: `pytest tests/test_triagem_unidade.py` no bot (precisa do ambiente do bot) e `npm test` no
app (10 testes de `vinculo.ts`).

## Teclado virtual cobrindo o campo de texto

**App.** O app é edge-to-edge no Android (padrão do Expo), então a janela não encolhe quando o
teclado abre. As telas usavam `KeyboardAvoidingView` só no iOS, e no Android o teclado cobria o
campo. Agora todas as telas com campo de texto usam `TelaComTeclado`
(`apps/mobile/src/components/TelaComTeclado.tsx`), com `behavior="padding"` nas duas plataformas,
como recomenda o guia de teclado do Expo: assistente, login, esqueci a senha, cadastro, perfil e
responder formulário. No chat, a última mensagem rola para cima do teclado, a folga da barra do
sistema sai enquanto o teclado está aberto e o aviso de privacidade se esconde para sobrar espaço.
Não há mudança nativa, então vai por atualização automática, sem APK novo.

**Landing.** O painel da assistente é `position: fixed`, e no celular o teclado ficava por cima do
campo. Agora:
- a meta `viewport` tem `interactive-widget=resizes-content`, que faz o Chrome do Android encolher
  a página quando o teclado abre (o formulário de contato também se beneficia);
- no iOS e nos navegadores que ignoram essa opção, o painel acompanha `window.visualViewport`: as
  variáveis `--assistente-teclado` e `--assistente-visivel` sobem e encolhem o painel acima do teclado.

Falta conferir em aparelhos reais (Android e iPhone, telas pequenas e grandes). Os testes automáticos
não cobrem o teclado.
