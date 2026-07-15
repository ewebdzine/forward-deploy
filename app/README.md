# Forward Deploy - the app

The deployable web application. Managers document departments (SOPs committed to your repo) and
build developer-ready plans with Claude; developers review them and pull approved plans into
Claude Code. See the [repo README](../README.md) for the full concept.

**Everything is configured by env vars** - copy [.env.example](.env.example) to `.env` and fill
it in. There is no config UI for secrets and no service of ours behind it: your Anthropic key,
your Postgres, your SMTP, your GitHub token.

The `/forward-deploy:kickoff` skill walks all of this interactively; this README is the manual
path and the self-host reference.

## Deploy to Vercel (recommended)

1. Fork or copy this repo into your GitHub account (your instance tracks your fork).
2. In Vercel: **Add New Project** -> import the repo -> set **Root Directory** to `app/`.
3. Add the env vars from `.env.example` (Vercel Postgres/Neon supplies `DATABASE_URL`;
   generate `AUTH_SECRET` and `FORWARD_DEPLOY_TOKEN` with `openssl rand -base64 32`).
4. Deploy, then run the schema + seed once from your machine:

```sh
cd app
npm install
DATABASE_URL=<your prod url> npm run db:push
DATABASE_URL=<your prod url> npm run seed -- admin@company.com "Admin Name" "Sales,Support"
```

5. Open the deployment, sign in with the admin email (magic link), and invite your managers
   under **Admin -> Users**. Check `<url>/api/health` - every check should be `ok`.

## Run locally

```sh
cd app
cp .env.example .env   # fill in
npm install
npm run db:push        # create the schema in your Postgres
npm run seed -- you@company.com "Your Name"
npm run dev            # http://localhost:3000
```

## Self-host / extranet

The app is a plain Next.js server - no Vercel-only APIs. `npm run build && npm run start`
behind your reverse proxy, with the same env vars and any reachable Postgres. Set `AUTH_URL`
to the public URL so magic links point at the right host. (A reference Dockerfile is planned -
see [SPEC.md](../SPEC.md) post-v1 items.)

## The pieces

| Path | What it is |
|---|---|
| `src/db/schema.ts` | Drizzle schema: users/roles, departments, plans + status workflow, plan messages, mockups, plan sessions, insights |
| `src/auth.ts` | Auth.js magic-link, invite-only (`signIn` callback), role on the session |
| `src/lib/access.ts` | `requireSession()` / `requireRole()` server-side guards |
| `src/lib/source-control/` | `SourceControlProvider` interface + GitHub (Octokit) implementation - the Bitbucket seam |
| `src/app/api/health` | per-dependency health: db, repo, anthropic, email - what `/forward-deploy:doctor` reads |
| `src/app/admin` | departments + user invites (creating a user IS the invitation) |
| `src/app/repo` | read-only browser over the connected repo - the connectivity proof |

## Status

Phase 1 (foundation). The SOP builder (Phase 2), plan builder + mockups (Phase 3), and the
review loop + plans API (Phase 4) are next - see [SPEC.md](../SPEC.md).
