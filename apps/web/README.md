# PASI — Painel web do profissional

React 19 + Vite 6 + TypeScript + Tailwind 3 + axios + React Router 7.
Reproduz as telas do protótipo aprovado (Claude Design), com o mesmo CSS.

## Rodar localmente

```bash
# na raiz do monorepo
npm install            # instala todos os workspaces (api, web, mobile)
cp apps/web/.env.example apps/web/.env
npm run api:dev        # API em http://localhost:3000/api
npm run web:dev        # painel em http://localhost:5173
```

`VITE_API_URL` aponta para a API (com `/api` no fim). No `.env` da API, use
`WEB_URL="http://localhost:5173"` para os links dos e-mails abrirem o painel.

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `src/styles` | `painel.css` e `ds-bundle.css` copiados do protótipo; `app.css` com os ajustes para a tela cheia; `tailwind.css` (utilidades, sem preflight) |
| `src/behaviors` | Comportamentos do protótipo portados: tooltip acessível, seletor segmentado que desliza, "deslize para confirmar", saída animada das janelas e morph |
| `src/api` | Cliente axios (token JWT, sessão vencida, bloqueio por Pendência I/II) e as chamadas de cada módulo |
| `src/auth` | Sessão (`AuthContext`) e as rotas por situação do cadastro |
| `src/components` | Peças reaproveitadas: menu lateral, cabeçalho, janelas, filtros, paginação, campos |
| `src/pages` | Uma tela por arquivo, com o número da tela do protótipo no comentário |

## Regras de acesso nas rotas

- Sem login: `/login`, `/esqueci-senha`, `/redefinir-senha?token=…`
- Pendência I: só `/primeiro-acesso`
- Pendência II: só `/inicio` e `/revisao`
- Deferido: atendimentos, formulários e Meu perfil
- Máximo (Deferido): também `/usuarios`

A API confere tudo de novo; as rotas só evitam telas que dariam erro.
