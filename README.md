# TWCS backend

API for the Tea Withering Control System. Node.js + Express + TypeScript modular monolith, with Prisma (PostgreSQL) and Socket.IO.

## Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

The API listens on http://localhost:4000 (`/api/v1`). PostgreSQL must be running and `DATABASE_URL` in `.env` must point at it. The monorepo `docker-compose.yml` starts a local database with user `twcs`, password `twcs`, database `twcs`.

Seeded dev login: `admin@twcs.local` / `Admin@12345`. Change it before any real deployment.

With `ENABLE_SIMULATOR=true` the server generates sensor readings every few seconds. Devices post readings to `POST /api/v1/telemetry/readings` with the `x-device-key` header.
