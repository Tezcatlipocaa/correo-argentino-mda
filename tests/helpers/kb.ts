import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../../src/db/index";
import {
  auditLogs,
  kbArticles,
  kbCategories,
  mesas,
  sessions,
  users,
} from "../../src/db/schema";
import {
  cleanupTestUser,
  createTestUserAndSession,
  type TestUser,
} from "./auth";

export type KbTestMesa = typeof mesas.$inferSelect;
export type KbArticleStatus = "draft" | "published" | "archived";

export async function ensureCategoryFixture(
  helpdeskId: number,
  name: string,
): Promise<number> {
  const [existing] = await db
    .select({ id: kbCategories.id })
    .from(kbCategories)
    .where(
      and(eq(kbCategories.helpdeskId, helpdeskId), eq(kbCategories.name, name)),
    )
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(kbCategories)
    .values({ helpdeskId, name })
    .returning({ id: kbCategories.id });
  return row.id;
}

const CLEANUP_ATTEMPTS = 2;
const KB_IMAGE_URL_PATTERN =
  /^\/api\/kb\/images\/([1-9]\d*)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpe?g|webp))$/i;

export const uniqueToken = () => randomUUID().slice(0, 8);

const uniqueHelpdeskId = () => {
  const hash = createHash("sha256").update(randomUUID()).digest();
  return 2_000_000_000 + (hash.readUInt32BE(0) % 1_000_000_000);
};

export async function setEasyMdeContent(
  page: Page,
  markdown: string,
): Promise<void> {
  const editor = page.locator(".EasyMDEContainer .CodeMirror");
  const source = page.locator('textarea[name="content"]');

  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(markdown);
  await expect.poll(async () => source.inputValue()).toBe(markdown);
}

export class KbTestFixture {
  private readonly articleIds = new Set<number>();
  private readonly mesaRows: KbTestMesa[] = [];
  private readonly testUsers: TestUser[] = [];
  private readonly imagePaths = new Set<string>();
  private readonly fixtureUserIds = new Set<number>();
  private readonly imageDirectories = new Map<string, boolean>();
  private readonly auditLogWatermark: number;

  constructor() {
    const [watermark] = db
      .select({ maxId: sql<number | null>`MAX(${auditLogs.id})` })
      .from(auditLogs)
      .all();
    this.auditLogWatermark = watermark?.maxId ?? 0;
  }

  async createMesa(): Promise<KbTestMesa> {
    const name = `KB E2E ${randomUUID()}`;
    const [mesa] = await db
      .insert(mesas)
      .values({
        invgateId: uniqueHelpdeskId(),
        name,
        displayName: name,
        active: true,
        assignable: true,
        lastSyncedAt: new Date().toISOString(),
      })
      .returning();
    const imageDirectory = path.join(
      path.resolve(process.env.EXTERNAL_STORAGE_DIR || "./data/storage"),
      "kb-images",
      String(mesa.invgateId),
    );
    this.imageDirectories.set(imageDirectory, fs.existsSync(imageDirectory));
    this.mesaRows.push(mesa);
    return mesa;
  }

  async createUser(role: string, mesa: KbTestMesa): Promise<TestUser> {
    const user = await createTestUserAndSession(role);
    this.testUsers.push(user);
    this.fixtureUserIds.add(user.userId);

    try {
      const username = `kb_${role.replace(/[^a-z0-9_]+/gi, "_")}_${randomUUID()}`;
      const result = await db
        .update(users)
        .set({
          username,
          helpdeskId: mesa.invgateId,
          helpdeskName: mesa.name,
        })
        .where(eq(users.id, user.userId))
        .run();
      if (result.changes !== 1) {
        throw new Error(`Failed to update test user ${user.userId}`);
      }
      user.username = username;
      return user;
    } catch (error) {
      try {
        await cleanupTestUser(user.userId, user.sessionId);
        const index = this.testUsers.findIndex(
          ({ userId }) => userId === user.userId,
        );
        if (index >= 0) this.testUsers.splice(index, 1);
        this.fixtureUserIds.delete(user.userId);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Failed to clean up partially configured test user",
        );
      }
      throw error;
    }
  }

  async createArticle(input: {
    mesa: KbTestMesa;
    authorUserId: number;
    title: string;
    content?: string;
    category?: string | null;
    status?: KbArticleStatus;
    publishedByUserId?: number | null;
  }): Promise<typeof kbArticles.$inferSelect> {
    const status = input.status ?? "published";
    const published = status === "published";
    const [article] = await db
      .insert(kbArticles)
      .values({
        helpdeskId: input.mesa.invgateId,
        title: input.title,
        content: input.content ?? `Contenido de prueba ${uniqueToken()}`,
        category: input.category ?? null,
        status,
        authorUserId: input.authorUserId,
        publishedByUserId: published
          ? (input.publishedByUserId ?? input.authorUserId)
          : null,
        publishedAt: published ? new Date() : null,
      })
      .returning();
    this.articleIds.add(article.id);
    return article;
  }

  trackArticle(articleId: number): void {
    this.articleIds.add(articleId);
  }

  trackImageUrl(url: string, expectedHelpdeskId: number): void {
    const pathname = new URL(url, "http://kb.test").pathname;
    const match = pathname.match(KB_IMAGE_URL_PATTERN);
    if (!match) {
      throw new Error(`Invalid KB image URL: ${url}`);
    }

    const helpdeskId = Number(match[1]);
    if (helpdeskId !== expectedHelpdeskId) {
      throw new Error(
        `KB image URL mesa ${helpdeskId} did not match expected mesa ${expectedHelpdeskId}`,
      );
    }
    if (!this.mesaRows.some((mesa) => mesa.invgateId === helpdeskId)) {
      throw new Error(`KB image URL uses an untracked mesa: ${url}`);
    }

    const storageRoot = path.resolve(
      process.env.EXTERNAL_STORAGE_DIR || "./data/storage",
    );
    const imagesRoot = path.join(storageRoot, "kb-images");
    const filePath = path.resolve(imagesRoot, String(helpdeskId), match[2]);
    if (!filePath.startsWith(`${imagesRoot}${path.sep}`)) {
      throw new Error(`KB image path escaped storage root: ${url}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`KB image file was not created: ${url}`);
    }
    this.imageDirectories.set(
      path.dirname(filePath),
      this.imageDirectories.get(path.dirname(filePath)) ??
        fs.existsSync(path.dirname(filePath)),
    );
    this.imagePaths.add(filePath);
  }

  private async deleteArticles(errors: unknown[]): Promise<void> {
    if (this.articleIds.size === 0) return;
    const articleIds = [...this.articleIds];
    let lastError: unknown;

    for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        db.delete(kbArticles).where(inArray(kbArticles.id, articleIds)).run();
        const remaining = db
          .select({ id: kbArticles.id })
          .from(kbArticles)
          .where(inArray(kbArticles.id, articleIds))
          .all();
        if (remaining.length === 0) {
          articleIds.forEach((id) => this.articleIds.delete(id));
          return;
        }
        lastError = new Error(
          `Articles still present after cleanup: ${remaining
            .map(({ id }) => id)
            .join(", ")}`,
        );
      } catch (error) {
        lastError = error;
      }
    }

    errors.push(lastError);
  }

  private deleteImages(errors: unknown[]): void {
    for (const filePath of this.imagePaths) {
      let lastError: unknown;
      let deleted = false;

      for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          if (!fs.existsSync(filePath)) {
            this.imagePaths.delete(filePath);
            deleted = true;
            break;
          }
          lastError = new Error(
            `Image still exists after cleanup: ${filePath}`,
          );
        } catch (error) {
          lastError = error;
        }
      }

      if (!deleted) {
        errors.push(
          lastError ?? new Error(`Image cleanup failed: ${filePath}`),
        );
      }
    }
  }

  private deleteImageDirectories(errors: unknown[]): void {
    for (const [directory, existedBeforeFixture] of this.imageDirectories) {
      if (existedBeforeFixture) continue;

      let lastError: unknown;
      let handled = false;
      for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
        try {
          if (!fs.existsSync(directory)) {
            handled = true;
            break;
          }
          if (fs.readdirSync(directory).length > 0) {
            handled = true;
            break;
          }
          fs.rmdirSync(directory);
          if (!fs.existsSync(directory)) {
            handled = true;
            break;
          }
          lastError = new Error(
            `Image directory still exists after cleanup: ${directory}`,
          );
        } catch (error) {
          lastError = error;
        }
      }

      if (handled) {
        this.imageDirectories.delete(directory);
      } else {
        errors.push(
          lastError ??
            new Error(`Image directory cleanup failed: ${directory}`),
        );
      }
    }
  }

  private deleteAuditLogs(errors: unknown[]): void {
    const userIds = [...this.fixtureUserIds];
    if (userIds.length === 0) return;

    let lastError: unknown;
    let deleted = false;
    for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        const fixtureUsers = db
          .select({ username: users.username })
          .from(users)
          .where(inArray(users.id, userIds))
          .all();
        if (fixtureUsers.length === 0) {
          deleted = true;
          break;
        }

        const usernames = fixtureUsers
          .map(({ username }) => username)
          .filter((username) => username.length > 0);
        if (usernames.length === 0) {
          deleted = true;
          break;
        }

        const conditions = and(
          gt(auditLogs.id, this.auditLogWatermark),
          inArray(auditLogs.username, usernames),
        );
        db.delete(auditLogs).where(conditions).run();
        const [remaining] = db
          .select({ id: auditLogs.id })
          .from(auditLogs)
          .where(conditions)
          .limit(1)
          .all();
        if (!remaining) {
          deleted = true;
          break;
        }
        lastError = new Error(
          `Audit logs still present after cleanup: ${remaining.id}`,
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (!deleted) {
      errors.push(lastError ?? new Error("Audit log cleanup failed"));
    }
  }

  private async deleteUsers(errors: unknown[]): Promise<void> {
    for (const user of [...this.testUsers]) {
      let lastError: unknown;
      let deleted = false;

      for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
        try {
          await cleanupTestUser(user.userId, user.sessionId);
          const [remainingUser] = db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, user.userId))
            .limit(1)
            .all();
          const [remainingSession] = db
            .select({ id: sessions.id })
            .from(sessions)
            .where(eq(sessions.id, user.sessionId))
            .limit(1)
            .all();
          if (!remainingUser && !remainingSession) {
            const index = this.testUsers.findIndex(
              ({ userId }) => userId === user.userId,
            );
            if (index >= 0) this.testUsers.splice(index, 1);
            this.fixtureUserIds.delete(user.userId);
            deleted = true;
            break;
          }

          lastError = new Error(
            `User ${user.userId} or session ${user.sessionId} still exists`,
          );
        } catch (error) {
          lastError = error;
        }
      }

      if (!deleted) {
        errors.push(
          lastError ?? new Error(`User cleanup failed: ${user.userId}`),
        );
      }
    }
  }

  private deleteMesas(errors: unknown[]): void {
    if (this.mesaRows.length === 0) return;
    const helpdeskIds = this.mesaRows.map(({ invgateId }) => invgateId);
    let lastError: unknown;
    let deleted = false;

    for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
      try {
        db.delete(mesas).where(inArray(mesas.invgateId, helpdeskIds)).run();
        const remaining = db
          .select({ invgateId: mesas.invgateId })
          .from(mesas)
          .where(inArray(mesas.invgateId, helpdeskIds))
          .all();
        if (remaining.length === 0) {
          this.mesaRows.length = 0;
          deleted = true;
          break;
        }
        lastError = new Error(
          `Mesas still present after cleanup: ${remaining
            .map(({ invgateId }) => invgateId)
            .join(", ")}`,
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (!deleted) {
      errors.push(lastError ?? new Error("Mesa cleanup failed"));
    }
  }

  async cleanup(): Promise<void> {
    const errors: unknown[] = [];
    const userIds = this.testUsers.map(({ userId }) => userId);
    const helpdeskIds = this.mesaRows.map(({ invgateId }) => invgateId);

    if (userIds.length > 0 && helpdeskIds.length > 0) {
      try {
        const discovered = await db
          .select({ id: kbArticles.id })
          .from(kbArticles)
          .where(
            and(
              inArray(kbArticles.authorUserId, userIds),
              inArray(kbArticles.helpdeskId, helpdeskIds),
            ),
          );
        discovered.forEach(({ id }) => this.articleIds.add(id));
      } catch (error) {
        errors.push(error);
      }
    }

    await this.deleteArticles(errors);
    this.deleteImages(errors);
    this.deleteImageDirectories(errors);
    this.deleteAuditLogs(errors);
    await this.deleteUsers(errors);
    this.deleteMesas(errors);

    if (errors.length > 0) {
      throw new AggregateError(errors, "KB E2E cleanup failed");
    }
  }
}
