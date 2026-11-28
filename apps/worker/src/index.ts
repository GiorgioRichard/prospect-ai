import { startWorker } from "./worker.js";

const worker = startWorker();

async function shutdown(signal: string): Promise<void> {
  console.info(`[worker] ${signal} recebido`);
  await worker.stop();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
