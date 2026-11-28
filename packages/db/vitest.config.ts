import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes compartilham o banco prospect_ai_test.
    fileParallelism: false,
  },
});
