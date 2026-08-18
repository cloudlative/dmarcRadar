import pino from "pino";

// No transport/worker-thread target here: pino's worker-based transports (e.g. pino-pretty)
// don't resolve reliably under Next.js's webpack bundling of server code. Plain JSON to
// stdout works everywhere (dev, worker script, production) and is what you want in prod anyway.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});
