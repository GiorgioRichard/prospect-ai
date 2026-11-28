/**
 * Ciclo de vida do worker. Filas (Redis/BullMQ) entram no épico E04; por ora o processo
 * apenas sobe, mantém-se vivo e encerra de forma limpa.
 */
export interface WorkerHandle {
  isRunning(): boolean;
  stop(): Promise<void>;
}

export function startWorker(log: (message: string) => void = console.info): WorkerHandle {
  let running = true;
  const keepAlive = setInterval(() => undefined, 60_000);
  log("[worker] iniciado");

  return {
    isRunning: () => running,
    stop: async () => {
      if (!running) return;
      running = false;
      clearInterval(keepAlive);
      log("[worker] encerrado");
    },
  };
}
