# Project Guidelines

## Architecture
- The API is a Fastify service in `server/`; PostgreSQL access and the Drizzle schema are in `server/src/db.ts`, while Redis access is in `server/src/redis.ts`.
- The React/Vite client lives in `client/` and calls the API directly; preserve the existing service boundary and endpoint behavior.
- See [README.md](README.md) for the project overview and infrastructure setup. Use [server/src/index.ts](server/src/index.ts), [client/src/api.ts](client/src/api.ts), and [tests/load.spec.ts](tests/load.spec.ts) as representative entry points.

## Code Style
- Follow the existing TypeScript style: single quotes, semicolons, two-space indentation, and trailing commas where already used.
- The server is ESM and uses `.js` extensions in relative TypeScript imports; preserve that convention.
- There is no root lint script. Use the package scripts that exist rather than inventing a lint command.

## Build and Test
- Start PostgreSQL and Redis with `docker compose up -d` from the repository root.
- Run the API from `server/` with `npm run dev`; it listens on port 3000. Run the client from `client/` with `npm run dev` (Vite defaults to port 5173).
- Build the API with `npm run build` from `server/`; build the client with `npm run build` from `client/`.
- Playwright uses `http://localhost:3000` and expects the API and its dependencies to be running. The only current test is a high-volume integration/load test: it may create a database user, sends an OTP through configured SMTP, reads that OTP from Redis, and issues 10,000 requests. Do not run it as a routine validation; confirm the environment and intended load before executing `npm test` from the repository root.
- The load test accepts `TEST_EMAIL`, `TEST_PASSWORD`, and `REDIS_URL`. The server also reads `DATABASE_URL`, `JWT_SECRET`, `PASSWORD_FINGERPRINT_SECRET`, and `SMTP_*` settings. Keep credentials in local environment configuration, never in source control.