# Requisitos de Negócio: Implementação de Acessibilidade Web (WCAG & eMAG)

## 1. Visão Geral
O objetivo deste documento é definir os requisitos funcionais e técnicos necessários para garantir que o sistema web seja inclusivo, atenda às diretrizes internacionais de acessibilidade (**WCAG 2.2**) e esteja em conformidade com o **Modelo de Acessibilidade em Governo Eletrônico (eMAG) 3.1**, padrão de acessibilidade digital adotado pelo governo federal brasileiro e de observância obrigatória nos sítios e portais públicos desde a Portaria n.º 3, de 7 de maio de 2007.

### 1.1 Escopo
* **Nesta etapa:** painel web do profissional (`apps/web`).
* **Etapa seguinte:** aplicativo mobile, na visão do paciente (`apps/mobile`), voltado ao público de baixo letramento (analfabetos, crianças e idosos). Implementada — ver 1.2.

### 1.2 Aplicativo mobile (paciente)
O app oferece as mesmas ferramentas do painel, adaptadas ao celular (código em `apps/mobile/src/acessibilidade/`):
* **Menu de acessibilidade (RF04):** botão no cabeçalho de todas as telas, inclusive a de entrada. Tamanho do texto, alto contraste, preto e branco, reduzir movimento, leitura em voz alta e redefinir, com as preferências salvas no aparelho. Inclui também o **tema escuro** (Automático, que segue o celular, Claro ou Escuro), pelo conforto visual.
* **Leitura em voz alta (RF05):** síntese de voz do próprio celular (`expo-speech`), em português do Brasil. No lugar de "clicar", **tocar** em um texto, botão ou campo lê o conteúdo, e o botão continua fazendo a ação. Avisos e erros também são lidos.
* **Leitores de tela (RF01) e erros (RF06):** rótulos e papéis de acessibilidade para o TalkBack; cada campo é identificado pelo rótulo e leva junto o erro, que é anunciado quando aparece.
* **Diferenças em relação ao painel:**
  * **Libras:** o VLibras não tem componente para aplicativos, só para páginas web, por isso fica de fora no app.
  * **Preto e branco:** muda as cores do app em qualquer aparelho, e as fotos só a partir do Android 12.
  * **Foco do teclado (RF03):** coberto pelo foco nativo do Android.

---

## 2. Requisitos Funcionais e de Experiência

### RF01 - Compatibilidade com Leitores de Tela
* **Objetivo:** Permitir que usuários com deficiência visual total ou baixa visão naveguem e compreendam todo o conteúdo do sistema utilizando tecnologias assistivas (softwares de leitura de tela e dispositivos braile).
* **Especificações:**
  * **Estrutura Semântica:** Utilizar marcação HTML semântica correta (tags como `header`, `nav`, `main`, `footer`, `article`, `button` e cabeçalhos em ordem hierárquica de `h1` a `h6`).
  * **Texto Alternativo (*Alt Text*):** Toda imagem informativa, ícone funcional ou elemento gráfico deve possuir descrição textual alternativa clara e objetiva via atributo `alt`. Imagens puramente decorativas devem ser marcadas como ocultas (`aria-hidden="true"`).
  * **Atributos ARIA:** Empregar propriedades e estados ARIA (*Accessible Rich Internet Applications*) sempre que componentes dinâmicos (modais, abas, menus suspensos) exigirem sinalização para leitores de tela.

### RF02 - Ajuste Visual e de Leitura
* **Objetivo:** Oferecer flexibilidade de visualização para atender usuários com baixa visão ou dificuldades de leitura.
* **Especificações:**
  * **Contraste de Cores:** Garantir a taxa mínima de contraste de cores do nível AA da WCAG entre o texto e o fundo (mínimo de 4.5:1 para textos normais e 3:1 para textos grandes).
  * **Tipografia Legível:** Utilizar preferencialmente fontes sem serifa e assegurar que o espaçamento entre linhas, palavras e parágrafos seja adequado.
  * **Ampliação de Tela (Zoom):** Permitir o redimensionamento de texto e zoom da página em até **200%** ou mais sem que ocorra quebra de layout, sobreposição de elementos ou perda de funcionalidade.

### RF03 - Navegação por Teclado e Atalhos
* **Objetivo:** Garantir a operação completa do sistema sem a dependência de um mouse ou cursor físico.
* **Especificações:**
  * **Foco Visual Claro (*Focus State*):** Todos os elementos interativos (links, botões, campos de formulário) devem exibir um indicador de foco visível, contrastado e inconfundível ao receberem a navegação via tecla `Tab`.
  * **Ordem Lógica de Foco:** A sequência de navegação pelo teclado deve seguir a ordem natural de leitura (da esquerda para a direita, de cima para baixo).
  * **Acessibilidade em Formulários:** Todos os campos de formulário devem estar associados a seus respectivos rótulos (`label`), permitindo preenchimento, validação e submissão completos apenas pelo teclado.

### RF04 - Painel de Ferramentas de Acessibilidade
* **Objetivo:** Disponibilizar no painel web as mesmas ferramentas já oferecidas na página de apresentação do PASI (`landing-page`, componente `AcessibilidadeMenu`), mantendo uma experiência consistente entre os módulos.
* **Especificações:**
  * **Acesso ao painel:** Botão fixo, visível em todas as telas (inclusive na de login), acionável por mouse e teclado, com rótulo acessível ("Abrir menu de acessibilidade").
  * **Tamanho do texto:** Controles para aumentar e diminuir o tamanho do texto.
  * **Alto contraste:** Alternância para um tema de alto contraste.
  * **Preto e branco:** Alternância para exibição em tons de cinza.
  * **Reduzir movimento:** Alternância que desliga animações e transições da interface, para usuários sensíveis a movimento ou com dificuldade de concentração (complementa a preferência de redução de movimento do sistema operacional, que o painel já respeita).
  * **Leitura em voz alta:** Ativação do recurso descrito no RF05.
  * **Libras:** Integração com o [VLibras](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/acessibilidade-digital/ferramentas) para tradução automática do conteúdo em Língua Brasileira de Sinais.
  * **Redefinir:** Botão que retorna todas as opções ao padrão.
  * **Persistência:** As preferências escolhidas devem ser mantidas ao navegar entre telas e ao recarregar a página.

### RF05 - Leitura em Voz Alta
* **Objetivo:** Permitir que o conteúdo das telas seja lido em voz alta, atendendo usuários com baixa visão, dificuldades de leitura ou baixo letramento.
* **Especificações:**
  * **Leitura ao clicar:** Com o recurso ativado, ao clicar (ou focar via teclado) em um texto, botão, rótulo ou campo, o sistema deve ler seu conteúdo em voz alta, em português do Brasil.
  * **Interrupção:** Uma nova leitura interrompe a anterior, e desativar o recurso encerra qualquer leitura em andamento.
  * **Avisos do sistema:** Com o recurso ativado, os avisos de ações realizadas (confirmações, sucessos e erros exibidos no canto inferior direito) também devem ser lidos em voz alta, atendendo ao feedback sonoro previsto na documentação do projeto.
  * **Tecnologia:** Utilizar a API de síntese de voz do navegador (*Web Speech API* — `speechSynthesis`), sem dependência de serviços externos, seguindo a implementação já existente na página de apresentação.
  * **Indisponibilidade:** Caso o navegador não ofereça síntese de voz, a opção deve ser exibida como indisponível, sem gerar erro.

### RF06 - Identificação e Sugestão de Correção de Erros
* **Objetivo:** Garantir que erros de preenchimento e de operação sejam percebidos e compreendidos por todos os usuários, inclusive os que utilizam leitores de tela (WCAG 3.3.1 e 3.3.3).
* **Especificações:**
  * **Identificação em texto:** O campo com problema deve ser indicado por mensagem textual, e não apenas por cor ou borda.
  * **Sugestão de correção:** A mensagem deve dizer o que está errado e, quando possível, como corrigir (ex.: "Informe um e-mail válido, como nome@exemplo.com").
  * **Associação ao campo:** O campo com erro deve receber `aria-invalid="true"` e estar ligado à mensagem por `aria-describedby`.
  * **Anúncio a tecnologias assistivas:** Mensagens de erro e avisos de ações (canto inferior direito) devem ser anunciados por leitores de tela, por meio de regiões `aria-live` (`role="alert"` para erros e `role="status"` para confirmações).

---

## 3. Critérios de Aceite e Conformidade
* **Padrão de Referência:** O sistema deve atingir a conformidade mínima com as diretrizes **WCAG 2.2**, nível **AA**, e com o **eMAG 3.1**.
* **Validação de Código:** Realizar testes automatizados (com ferramentas como axe, Lighthouse) e auditorias manuais periódicas (incluindo testes de navegação sem mouse e simulação de leitores de tela como NVDA ou VoiceOver).
