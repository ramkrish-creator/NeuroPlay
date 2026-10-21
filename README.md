# NeuroPlay

NeuroPlay is a browser-based cognitive training application with seven games,
adaptive difficulty, progress tracking, and account-based session history.

## Local development

1. Install Node.js 20+ and PostgreSQL 13+ (or use the provided Docker Compose database).
2. Copy `.env.example` to `.env`. Set unique `ADMIN_PASSWORD` and PostgreSQL credentials.
3. Start PostgreSQL with `docker compose up -d db`, or provide your own PostgreSQL database.
4. Run `npm install` and `npm run dev`.
5. Open the Vite URL and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

The API applies `server/schema.sql` and creates the initial administrator on startup.
New user accounts are created by an administrator. The API generates a one-time
temporary password; users must set a new password at first login.

## Existing browser profiles

Existing profiles remain in this browser's `neuroplay-store` data until explicitly
removed. Sign in as the administrator on the browser that contains the profiles,
open **Users**, and choose **Import legacy profiles**. The import copies profiles,
session history, and saved difficulty settings into PostgreSQL, and displays
one-time temporary credentials. Distribute those credentials securely. Do not
clear browser storage until you have confirmed the imported accounts and history.

## Production deployment

The frontend and API must be served from the same HTTPS origin (or placed behind
a same-origin reverse proxy that routes `/api` to the API server). Configure
`DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `APP_ORIGIN`, and `NODE_ENV`
in the hosting environment; never commit `.env` or production credentials.
GitHub Pages and the standalone single-file bundle cannot host this API.

## Commands

```bash
npm run dev       # Vite frontend and API server
npm run dev:api   # API only
npm run build     # Type-check and production frontend/API builds
npm run start:api # Start compiled API server
npm run lint
```

The API uses PostgreSQL for user accounts, hashed passwords, sessions, and
training results. Password hashes use bcrypt; login sessions use secure,
HTTP-only cookies. Player data is scoped to the authenticated user.
