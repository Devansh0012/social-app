---
name: verify
description: Build, run, and drive the Braventex stack (Postgres + Fastify/GraphQL API + Next.js web) to verify changes end-to-end.
---

# Verifying Braventex end-to-end

## Boot (all commands from repo root)

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"   # pnpm lives here (via corepack)
pnpm db:up                                  # Postgres 16 + Adminer via docker compose
cd apps/api && pnpm exec prisma migrate deploy && pnpm exec prisma db seed && cd ../..
pnpm api:dev   # Fastify on :4000 (background; ready when /health returns ok)
pnpm web:dev   # Next.js on :3000 (background; ~2s)
curl -s http://localhost:4000/health
```

Gotchas:
- `pnpm` is not on PATH by default — always export the nvm bin path first.
- Seed is idempotent for users/colleges/communities but **re-running it duplicates the two sample posts** (they use `create`, not upsert). Seed once.
- API warns `"root" path .../uploads must exist` at boot — harmless; dir is created on first upload.
- Access tokens expire in 15 min (dev .env) — re-login if GraphQL starts returning UNAUTHENTICATED mid-session.

## Seeded logins
- admin: `admin@braventex.dev` / `Braventex123!` (role ADMIN)
- student: `ada@braventex.dev` / `Student123!`
- Signup only accepts seeded college domains; `@braventex.dev` is the dev college. Signup returns `verifyTokenDev` for driving email verification without an email provider.

## Driving the API
GraphQL at `http://localhost:4000/graphql`, bearer auth. Login shape: `login(input:{email,password}){tokens{accessToken refreshToken} viewer{...}}`.
Field-name traps hit before: community membership is `viewerMembership{role}` (not viewerIsMember); username check is `isUsernameAvailable`; `adminColleges` is a plain list (no connection); there is no `isEdited` field on Post/Comment.

## Websockets
- `ws://localhost:4000/ws/notifications?token=<accessToken>` → HELLO on connect, then NOTIFICATION_NEW / DM_NEW.
- `ws://localhost:4000/ws/rooms/:roomId?token=...` → PRESENCE_JOINED/LEFT, CHAT_MESSAGE, POMODORO_TICK.
- Bad token closes with code 4001. Use the `ws` package from the pnpm store (`node_modules/.pnpm/ws@*/node_modules/ws`, CJS default import) — no global WebSocket in Node 20.

## Web flows worth driving (localhost:3000)
login → feed (composer posts land in the **Global** tab, not "For you") → post detail (like/comment) → /messages (open thread; realtime: send a DM via API as the other user and watch it appear live) → /communities → /discover (search) → /study-rooms (room page has chat + pomodoro) → /u/ada → as admin: /admin/users, /admin/colleges.

## Known pre-existing issues (don't re-flag as regressions)
- GraphQL `NotificationType` enum is missing `NEW_FOLLOWER` and `NEW_DM` (Prisma has them) → notifications query errors and /notifications renders blank once such a row exists.
- Banned users keep working with an existing access token (ban enforced only at login/refresh; 15-min window).
- `Community.postCount` denorm counter is never incremented (always 0).
- WS room channel doesn't check room membership, only room existence.
