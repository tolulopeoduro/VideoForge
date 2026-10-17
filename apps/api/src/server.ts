import pg from "pg";
import { buildApp } from "./app";
import { renderQueue } from "./queue";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp({ pool, renderQueue, logger: true });

await app.listen({ port: Number(process.env.API_PORT ?? 4000), host: "0.0.0.0" });
