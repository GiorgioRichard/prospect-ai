import { describe, expect, it } from "vitest";
import { startWorker } from "./worker.js";

describe("startWorker", () => {
  it("inicia e encerra de forma idempotente", async () => {
    const logs: string[] = [];
    const worker = startWorker((message) => logs.push(message));
    expect(worker.isRunning()).toBe(true);

    await worker.stop();
    await worker.stop();

    expect(worker.isRunning()).toBe(false);
    expect(logs).toEqual(["[worker] iniciado", "[worker] encerrado"]);
  });
});
