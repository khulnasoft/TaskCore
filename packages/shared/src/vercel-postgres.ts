/**
 * Resolve a PostgreSQL connection URL from the environment.
 *
 * Vercel exposes the database connection through several conventions:
 *   - `DATABASE_URL`                    (explicit; always wins)
 *   - `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` (Vercel Postgres)
 *   - `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGSSLMODE` (AWS RDS integration)
 *
 * Returns `undefined` when no usable connection is configured.
 */
export function resolvePostgresUrlFromEnv(): string | undefined {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const pooled = process.env.POSTGRES_URL?.trim();
  if (pooled) return pooled;

  const nonPooling = process.env.POSTGRES_URL_NON_POOLING?.trim();
  if (nonPooling) return nonPooling;

  const host = process.env.PGHOST?.trim();
  const database = process.env.PGDATABASE?.trim();
  if (!host || !database) return undefined;

  const user = encodeURIComponent(process.env.PGUSER?.trim() || "postgres");
  const password = process.env.PGPASSWORD ? encodeURIComponent(process.env.PGPASSWORD) : "";
  const port = process.env.PGPORT?.trim() || "5432";

  const auth = `${user}${password ? `:${password}` : ""}`;
  let url = `postgres://${auth}@${host}:${port}/${database}`;

  const sslMode = process.env.PGSSLMODE?.trim();
  if (sslMode && sslMode !== "disable") {
    url += "?sslmode=require";
  }

  return url;
}
