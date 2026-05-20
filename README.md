# Braventex

A student-only collaboration & community platform — communities, social feed, project collaboration, study materials, study rooms, notifications. Mobile-first, dark-by-default, modular monolith.

## Stack

- **Frontend** — Next.js 15 (App Router), TypeScript, TailwindCSS v4, shadcn-style primitives, Zustand, TanStack Query, Framer Motion
- **Backend** — Node.js + Fastify, Mercurius (GraphQL), Prisma, WebSockets
- **Database** — PostgreSQL 16
- **Storage** — pluggable driver (local in dev, S3/R2 ready)
- **Auth** — Email + password, college-email gate, JWT access + rotating refresh tokens

## Layout

```
braventex/
├── apps/
│   ├── api/         # Fastify + Mercurius + Prisma backend
│   └── web/         # Next.js 15 frontend
├── docker-compose.yml
└── .env.example
```

## Local setup

Prerequisites: Node 20+, pnpm 10+, Docker.

```bash
# 1. Install deps
pnpm install

# 2. Bring up Postgres
pnpm db:up

# 3. Configure env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# 4. Run Prisma migrations + seed
pnpm prisma:migrate
pnpm prisma:seed

# 5. Start dev servers
pnpm dev
```

- API: http://localhost:4000
- GraphQL playground: http://localhost:4000/graphiql
- Web: http://localhost:3000
- Adminer (DB GUI): http://localhost:8080

## Development

- `pnpm api:dev` — run API only
- `pnpm web:dev` — run Web only
- `pnpm prisma:studio` — Prisma Studio
- `pnpm typecheck` — typecheck all packages
- `pnpm lint` — lint all packages

## Product features (MVP)

1. College-email-verified signup, JWT auth, onboarding
2. Communities (create / join / leave / search)
3. Social feed — text/image/markdown/link posts, like / comment / bookmark / share
4. Collaboration posts — "Looking for collaborators" with applications
5. Study materials — upload PDFs / notes / links, filter by college/dept/semester/subject
6. Study rooms — virtual rooms with chat + pomodoro (no audio/video in MVP)
7. Notifications — in-app + WebSocket realtime
8. Global search
9. Analytics event log (recommendation-ready)
10. Admin dashboard — bans, removals, reports, analytics

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** for a step-by-step production deploy guide to `braventex.in` (Vercel + Railway + Neon + Cloudflare R2 + Resend + GoDaddy DNS).

## Architecture

Modular monolith. Backend organised by feature module (`auth`, `user`, `community`, `post`, `studyMaterial`, `studyRoom`, `notification`, `search`, `admin`). Each module owns a slice of GraphQL schema, resolvers, services, and Prisma access. Cross-cutting infra (storage, event bus, WS manager, logger, errors, JWT) lives in `core/`.

Event bus is in-process for MVP — drop in Redis/NATS later without changing call sites. Analytics events are persisted as rows in `AnalyticsEvent` so they're immediately queryable for future recommendation systems.
