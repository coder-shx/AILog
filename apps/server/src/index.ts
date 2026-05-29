import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 1421);
const host = process.env.HOST ?? "127.0.0.1";

const app = await buildApp();
await app.listen({ port, host });
