### PASI — Monorepo

Plataforma de apoio ao pré-diagnóstico de crianças com indícios de ansiedade.
Arquitetura em 3 camadas:

- **Apresentação** — React Native com Expo (`apps/mobile`)
- **Negócio** — API RESTful NestJS (`apps/api`)
- **Dados** — PostgreSQL no Neon, acessado via Prisma ORM

## Estrutura

```
pasi/
├── apps/
│   ├── api/      # NestJS + Prisma (camada de negócio)
│   └── mobile/   # React Native + Expo (camada de apresentação)
└── package.json  # npm workspaces
```

## Pré-requisitos

- Node.js 20+ (testado no 25)
- Banco PostgreSQL (ex.: Neon) criado a partir do DDL do projeto
- Para o app: Expo Go no celular, um emulador Android/iOS ou um navegador

## Rodando a API

```bash
# na raiz do monorepo
npm install

# variáveis de ambiente
cp apps/api/.env.example apps/api/.env
# edite apps/api/.env: DATABASE_URL, DIRECT_URL e JWT_SECRET

# gerar o Prisma Client a partir do schema versionado
npm run prisma:generate --workspace apps/api

# subir a API em modo dev
npm run api:dev
```

A API sobe em `http://localhost:3000/api` e a documentação (Swagger) fica em
`http://localhost:3000/api/docs`.

> Os scripts SQL de alteração do banco ficam em `apps/api/prisma/sql/` e devem ser
> aplicados manualmente, em ordem de data. `npm run prisma:pull` sobrescreve o
> `schema.prisma` com o estado do banco — use só para sincronizar após mudanças feitas
> direto no banco.

## Rodando o app

```bash
# com a API rodando (ver acima)
cd apps/mobile
npx expo start          # QR code para o Expo Go
npx expo start --web    # no navegador
```

Por padrão o app usa a API local (`localhost`, ou `10.0.2.2` no emulador Android).
Para apontar para outra API (ex.: a publicada), copie `apps/mobile/.env.example`
para `apps/mobile/.env` e defina `EXPO_PUBLIC_API_URL`.

## Deploy

- **API:** qualquer serviço Node (ex.: Render), com build `npm run api:build`,
  start `npm run api:start` e as variáveis do `apps/api/.env.example`.
- **App:** Expo/EAS, com `EXPO_PUBLIC_API_URL` apontando para a API publicada.

## Integrantes/colaboradores:

- Anna Carolina Leite;
- Ellen Eufrásio de Oliveira;
- Hector Ferreira da Silva.

## NOTA!

Este é um projeto em DESENVOLVIMENTO e pode sofrer alterações significativas no decorrer de sua evolução. A solução aqui foi apresentada como projeto integrador do 5º semestre do curso de Desenvolvimento de Software Multiplataforma da Faculdade de Tecnologia de Mauá. A ideia é evoluirmos o projeto para ser apresentado como Trabalho de Conclusão de Curso (TCC).
