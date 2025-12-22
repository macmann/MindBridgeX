# MindBridge X

MindBridge X is a full-stack playground for rapidly designing mock REST endpoints, testing payloads, and exposing them to Model Context Protocol (MCP) clients. The toolkit bundles a mock API web server, an MCP bridge, and a CLI code generator so you can prototype integrations quickly.

## Overview

MindBridge X provides a visual dashboard for crafting endpoints, a JSON-RPC bridge that turns those endpoints into MCP tools, and a generator CLI that scaffolds code from natural-language prompts. It stores all configuration in SQLite by default and secures the admin interface with an `ADMIN_KEY`.

## Features

- **Visual endpoint builder**: Create REST routes with method, path, headers, delays, and status toggles. Built-in request logs help you trace payloads without leaving the dashboard.
- **Templated responses**: Use Handlebars-style helpers with environment variables, path params, and reusable snippets to craft dynamic JSON bodies.
- **MCP bridge**: Map your mock endpoints to MCP servers and tools with per-tool JSON schemas, then expose them under `/mcp/:slug` with automatic request validation and logging.
- **Code generator CLI**: Stream OpenAI-powered scaffolds from natural-language prompts (`npm run generate -- "prompt"`).
- **Secure persistence**: SQLite by default (or Postgres via `DATABASE_URL`), Prisma migrations, and NextAuth credential login gated by `ADMIN_KEY`.
- **Operational middleware**: Helmet, compression, morgan logging, and a simple `/api/health` endpoint for liveness probes.

## Installation

### Requirements

- Node.js 18 or later
- npm 9 or later

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the sample environment and adjust values (especially `ADMIN_KEY`, `NEXTAUTH_SECRET`, and `OPENAI_API_KEY` if you plan to use the generator):
   ```bash
   cp .env.example .env
   ```
   The defaults target SQLite via `DATABASE_URL="file:./prisma/dev.db"`. Point this to Postgres for production parity.
3. Create or update the database schema with Prisma (uses `DATABASE_URL`):
   ```bash
   npm run db:migrate
   ```

## Usage

### Run the web dashboard and mock API

Start the Next.js app (includes the admin UI and mock API routes):

```bash
npm run dev
```

Then open `http://localhost:3000/login` and sign in with the default admin credentials (`admin@example.com` / `password`). From here you can create projects, endpoints, and MCP mappings.

For a production-style start that serves the compiled app, run:

```bash
npm run build
npm run start
```

### Use the MCP JSON-RPC bridge

1. In the dashboard, create an MCP server and add tools that point at your mock endpoints.
2. Send JSON-RPC 2.0 requests to `POST http://localhost:3000/mcp/<slug>`; the base `/mcp` proxies to the default slug.
3. Health check: `GET http://localhost:3000/mcp/<slug>` returns a basic status payload.

### Generate code with OpenAI

Use the CLI to scaffold snippets from natural-language prompts (requires `OPENAI_API_KEY`):

```bash
npm run generate -- "Write a function that parses a CSV string into objects"
```

The command streams responses to stdout so you can copy/paste the generated code.

## Architecture


```
API-MCPGenTool/
├─ server.js              # HTTP server wrapper for the Express app
├─ index.js               # Entry point for the mock API web server
├─ mcp-express.js         # Express router implementing the MCP JSON-RPC bridge
├─ src/index.js           # CLI code generator using OpenAI's Responses API
├─ gui-mock-api/          # Admin dashboard routes, views, and SQLite helpers
├─ public/                # Static assets served by the GUI (if applicable)
├─ package.json           # Root package scripts & dependencies
└─ README.md
```

## Database Setup

- **Local development**: Uses SQLite by default. Copy `.env.example` to `.env`, keep `DATABASE_URL="file:./prisma/dev.db"`, and run `npm run db:migrate` to create the schema plus generate the Prisma Client locally. You can also point `DATABASE_URL` at a local Postgres instance if you prefer.
- **Production**: Provision a managed Postgres database (Neon, Supabase, Render, Railway, etc.), set `DATABASE_URL` to the provided connection string, and run `npm run db:migrate:deploy` so the schema stays up to date.

## Database configuration

### Local development

- Use the default SQLite URL (`DATABASE_URL="file:./prisma/dev.db"`) for a zero-dependency dev setup, or point `DATABASE_URL` at a local Postgres instance.
- After changing the connection string, rerun `npm run db:migrate` (or `npm run db:generate`) so Prisma refreshes the client for that database.

### Production (Render)

- Render (and similar hosts) require a PostgreSQL `DATABASE_URL` (SQLite files aren't persisted in those environments).
- Build Command:
  ```bash
  npm install && \
  ./node_modules/.bin/prisma generate && \
  ./node_modules/.bin/prisma migrate deploy && \
  npm run build
  ```
- Start Command:
  ```bash
  npm start
  ```

## Deployment

### Deployment → Vercel

1. Import the GitHub repository into Vercel and select the default project settings.
2. Configure environment variables in the Vercel dashboard:
   - `DATABASE_URL` (SQLite for local dev or Postgres in production)
   - `NEXTAUTH_URL` (your Vercel site URL)
   - `NEXTAUTH_SECRET` (strong random value)
   - `GITHUB_ID`, `GITHUB_SECRET` (optional GitHub OAuth)
   - Any other app secrets you use (`OPENAI_API_KEY`, `ADMIN_KEY`, `MCP_PUBLIC_URL`, etc.).
3. Build command: `npm run build` (runs `prisma generate && next build`).
4. Start command: `npm run start`.
5. Run database migrations for the first deploy using `npm run db:migrate:deploy` as a post-deploy or manual job against the production `DATABASE_URL`.
6. Order of operations for the first launch: set environment variables → trigger a build → run migrations → open the app and sign in.

### Deployment → Generic Node Host (Render/Railway/etc.)

- **Runtime**: Use Node.js ≥ 18 (per `package.json` engines).
- **Environment**: Set the same variables as above (`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider keys, `OPENAI_API_KEY`, etc.).
- **Build**: `npm run build`.
- **Start**: `npm run start`.
- **Migrations**: On first deploy (or after schema changes), run `npm run db:migrate:deploy` with the production `DATABASE_URL` before starting the app.

### Deployment (Render)

- **Database**: Render's managed Postgres (or any external Postgres) must be wired in through the `DATABASE_URL` environment variable. SQLite files are not supported in the Render runtime filesystem, so always supply a Postgres URL when deploying there.
- **Build command** (Render dashboard → _Build Command_):
  ```bash
  npm install && npm run render:build
  ```
  The `render:build` script chains `db:generate`, `db:migrate:deploy`, and `build` so Prisma runs inside `npm run`'s environment
  (which automatically exposes `./node_modules/.bin`). This avoids relying on `npx`, which some managed builders omit from the
  PATH even when `npm` is available.
- **Start command** (Render dashboard → _Start Command_):
  ```bash
  npm start
  ```
- **Required environment variables** (Render dashboard → _Environment_):
  - `DATABASE_URL` – Postgres connection string (required for boot & migrations).
  - `NEXTAUTH_SECRET` – strong random secret for NextAuth.
  - `NEXTAUTH_URL` – public HTTPS URL of your Render service.
  - `ADMIN_DEFAULT_ENABLED=false` – recommended so production admins must be created manually via the CLI/DB and the default seeded admin stays disabled.
  - Any other provider keys you need (e.g., `OPENAI_API_KEY`, OAuth keys, etc.).
- **Migrations at deploy time**: Because Render containers are immutable once built, make sure `npm run db:migrate:deploy` runs before `npm start`. The build command sequence above handles the Prisma client generation and migrations so no runtime path ever falls back to `prisma migrate dev`.

### Health check

- Endpoint: `GET /api/health`
- Response: `{ "status": "ok", "database": "ok" | "unavailable" }`
- Use this for uptime checks on Render, Railway, or other orchestrators.

### Dev-only regression check

- Run `node scripts/dev-checks/mock-route-regression.mjs` after setting `DATABASE_URL` (and optionally `MOCK_BASE_URL` when the Next.js server is running) to quickly verify mock routes can store GET responses and POST request samples end-to-end.

### Deployment Checklist

- Copy `.env.example` to `.env` and fill in values.
- Local dev: ensure `DATABASE_URL=file:./prisma/dev.db` (or point to a local Postgres instance).
- Run `npm run db:migrate`.
- Run `npm run dev`.
- Production:
  - Provision Postgres and set `DATABASE_URL`.
  - Set `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and any provider keys (e.g., GitHub OAuth).
  - Run `npm run db:migrate:deploy`.
  - Run `npm run build` and `npm run start`.

## Screenshots

Screenshots of the admin dashboard and MCP configuration UI can be added here when available.

## Contributing Instructions

1. Fork the repository and create a feature branch.
2. Run `npm install` to install dependencies.
3. Add or update tests where appropriate.
4. Use clear commit messages and open a pull request describing your changes.

## Roadmap

- Add automated tests for endpoint templating and MCP mappings.
- Publish Docker assets for easier deployment.
- Expand CLI prompts and scaffolds for common API patterns.
- Provide sample MCP clients and SDK snippets.
- Attach example screenshots and walkthroughs to the documentation.
