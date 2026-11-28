/**
 * Isolamento entre tenants direto no SQL, com a role de runtime app_user (ADR-006).
 * Requer PostgreSQL descartável com migrações aplicadas.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadTestDatabaseEnv, resetTestDatabase } from "./testing.js";

const env = loadTestDatabaseEnv();
const owner = new pg.Client({ connectionString: env.ownerUrl });
const app = new pg.Client({ connectionString: env.appUrl });

const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const viewerA = randomUUID();
const leadA = randomUUID();
const leadB = randomUUID();

/** Executa como app_user com app.user_id definido, sempre revertendo ao final. */
async function asUser<T>(userId: string | null, fn: (db: pg.Client) => Promise<T>): Promise<T> {
  await app.query("BEGIN");
  try {
    if (userId) await app.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    return await fn(app);
  } finally {
    await app.query("ROLLBACK");
  }
}

async function expectRlsError(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: "42501" });
}

beforeAll(async () => {
  await resetTestDatabase(env.ownerUrl);
  await owner.connect();
  await app.connect();
  await owner.query(`INSERT INTO "Organization" (id, name) VALUES ($1, 'A'), ($2, 'B')`, [orgA, orgB]);
  await owner.query(
    `INSERT INTO "Membership" ("organizationId", "userId", role) VALUES
       ($1, $3, 'OWNER'), ($1, $5, 'VIEWER'), ($2, $4, 'OWNER')`,
    [orgA, orgB, userA, userB, viewerA],
  );
  await owner.query(
    `INSERT INTO "Lead" (id, "organizationId", name) VALUES ($1, $2, 'Lead A'), ($3, $4, 'Lead B')`,
    [leadA, orgA, leadB, orgB],
  );
});

afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("RLS com app_user", () => {
  it("sem app.user_id não enxerga nenhuma linha (falha fechada)", async () => {
    await asUser(null, async (db) => {
      expect((await db.query(`SELECT id FROM "Organization"`)).rowCount).toBe(0);
      expect((await db.query(`SELECT id FROM "Lead"`)).rowCount).toBe(0);
      expect((await db.query(`SELECT 1 FROM "Membership"`)).rowCount).toBe(0);
    });
  });

  it("usuário A só lê dados do workspace A", async () => {
    await asUser(userA, async (db) => {
      const orgs = await db.query<{ id: string }>(`SELECT id FROM "Organization"`);
      expect(orgs.rows.map((r) => r.id)).toEqual([orgA]);
      const leads = await db.query<{ id: string }>(`SELECT id FROM "Lead"`);
      expect(leads.rows.map((r) => r.id)).toEqual([leadA]);
      const byId = await db.query(`SELECT id FROM "Lead" WHERE id = $1`, [leadB]);
      expect(byId.rowCount).toBe(0);
    });
  });

  it("usuário A não insere lead no workspace B", async () => {
    await asUser(userA, (db) =>
      expectRlsError(
        db.query(`INSERT INTO "Lead" (id, "organizationId", name) VALUES ($1, $2, 'x')`, [
          randomUUID(),
          orgB,
        ]),
      ),
    );
  });

  it("usuário A não altera nem apaga dados de B", async () => {
    await asUser(userA, async (db) => {
      expect((await db.query(`UPDATE "Lead" SET name = 'hack' WHERE id = $1`, [leadB])).rowCount).toBe(0);
      expect((await db.query(`DELETE FROM "Lead" WHERE id = $1`, [leadB])).rowCount).toBe(0);
      expect((await db.query(`DELETE FROM "Membership" WHERE "organizationId" = $1`, [orgB])).rowCount).toBe(0);
      expect((await db.query(`UPDATE "Organization" SET name = 'hack' WHERE id = $1`, [orgB])).rowCount).toBe(0);
    });
  });

  it("WITH CHECK impede mover lead de A para B", async () => {
    await asUser(userA, (db) =>
      expectRlsError(db.query(`UPDATE "Lead" SET "organizationId" = $1 WHERE id = $2`, [orgB, leadA])),
    );
  });

  it("usuário A não se adiciona ao workspace B", async () => {
    await asUser(userA, (db) =>
      expectRlsError(
        db.query(`INSERT INTO "Membership" ("organizationId", "userId", role) VALUES ($1, $2, 'OWNER')`, [
          orgB,
          userA,
        ]),
      ),
    );
  });

  it("VIEWER lê mas não escreve", async () => {
    await asUser(viewerA, async (db) => {
      expect((await db.query(`SELECT id FROM "Lead"`)).rowCount).toBe(1);
      expect((await db.query(`UPDATE "Lead" SET name = 'x' WHERE id = $1`, [leadA])).rowCount).toBe(0);
    });
    await asUser(viewerA, (db) =>
      expectRlsError(
        db.query(`INSERT INTO "Lead" (id, "organizationId", name) VALUES ($1, $2, 'x')`, [
          randomUUID(),
          orgA,
        ]),
      ),
    );
  });

  it("app_user não acessa a tabela de migrações", async () => {
    await asUser(userA, (db) => expectRlsError(db.query(`SELECT 1 FROM "_prisma_migrations"`)));
  });

  it("create_workspace exige usuário e cria OWNER", async () => {
    await asUser(null, (db) => expectRlsError(db.query(`SELECT app.create_workspace('Novo')`)));
    await asUser(userB, async (db) => {
      const created = await db.query<{ id: string }>(`SELECT app.create_workspace('  Novo  ') AS id`);
      const id = created.rows[0]?.id;
      const org = await db.query<{ name: string }>(`SELECT name FROM "Organization" WHERE id = $1`, [id]);
      expect(org.rows[0]?.name).toBe("Novo");
      const member = await db.query<{ role: string }>(
        `SELECT role FROM "Membership" WHERE "organizationId" = $1 AND "userId" = $2`,
        [id, userB],
      );
      expect(member.rows[0]?.role).toBe("OWNER");
    });
  });
});
