import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Helper logic for detecting and grouping MDA 3950 operators from comments.
 */
export function extractCommentingOperators(comments, mdaMemberIdSet, memberMap = new Map()) {
  const opMap = new Map();

  for (const c of comments) {
    if (!c.author_id) continue;
    if (mdaMemberIdSet.has(c.author_id)) {
      if (!opMap.has(c.author_id)) {
        const memberInfo = memberMap.get(c.author_id);
        opMap.set(c.author_id, {
          authorId: c.author_id,
          authorName: memberInfo?.fullName || c.author_name || `Usuario #${c.author_id}`,
          username: memberInfo?.username || "",
          commentCount: 0,
          lastCommentAt: c.created_at || 0,
          firstCommentAt: c.created_at || 0,
          comments: [],
        });
      }
      const record = opMap.get(c.author_id);
      record.commentCount += 1;
      record.comments.push(c);
      if (c.created_at > record.lastCommentAt) {
        record.lastCommentAt = c.created_at;
      }
      if (c.created_at < record.firstCommentAt) {
        record.firstCommentAt = c.created_at;
      }
    }
  }

  return Array.from(opMap.values());
}

describe("MDA 3950 commenting operators detection & grouping", () => {
  const mdaMembers = [
    { id: 101, username: "jperez", name: "Juan", lastname: "Perez", fullName: "Juan Perez" },
    { id: 102, username: "mgomez", name: "Maria", lastname: "Gomez", fullName: "Maria Gomez" },
    { id: 103, username: "clopez", name: "Carlos", lastname: "Lopez", fullName: "Carlos Lopez" },
  ];

  const mdaMemberIdSet = new Set(mdaMembers.map((m) => m.id));
  const mdaMemberMap = new Map(mdaMembers.map((m) => [m.id, m]));

  it("should return empty list when no comments exist", () => {
    const ops = extractCommentingOperators([], mdaMemberIdSet, mdaMemberMap);
    assert.deepEqual(ops, []);
  });

  it("should ignore comments made by non-MDA members (e.g. client/customer)", () => {
    const comments = [
      { id: 1, incident_id: 500, author_id: 999, author_name: "Cliente Externo", created_at: 1000, message: "Ayuda" },
      { id: 2, incident_id: 500, author_id: 888, author_name: "Otro Usuario", created_at: 1100, message: "Info" },
    ];
    const ops = extractCommentingOperators(comments, mdaMemberIdSet, mdaMemberMap);
    assert.equal(ops.length, 0);
  });

  it("should detect single MDA operator and enrich metadata from member map", () => {
    const comments = [
      { id: 1, incident_id: 500, author_id: 101, author_name: "jperez", created_at: 1000, message: "En revisión" },
      { id: 2, incident_id: 500, author_id: 999, author_name: "Cliente", created_at: 1050, message: "Gracias" },
      { id: 3, incident_id: 500, author_id: 101, author_name: "jperez", created_at: 1100, message: "Solucionado" },
    ];
    const ops = extractCommentingOperators(comments, mdaMemberIdSet, mdaMemberMap);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].authorId, 101);
    assert.equal(ops[0].authorName, "Juan Perez");
    assert.equal(ops[0].username, "jperez");
    assert.equal(ops[0].commentCount, 2);
    assert.equal(ops[0].firstCommentAt, 1000);
    assert.equal(ops[0].lastCommentAt, 1100);
  });

  it("should detect and group multiple MDA operators commenting on same ticket", () => {
    const comments = [
      { id: 1, incident_id: 501, author_id: 101, author_name: "jperez", created_at: 1000, message: "Paso 1" },
      { id: 2, incident_id: 501, author_id: 102, author_name: "mgomez", created_at: 1020, message: "Paso 2" },
      { id: 3, incident_id: 501, author_id: 101, author_name: "jperez", created_at: 1050, message: "Paso 3" },
      { id: 4, incident_id: 501, author_id: 103, author_name: "clopez", created_at: 1100, message: "Paso 4" },
    ];
    const ops = extractCommentingOperators(comments, mdaMemberIdSet, mdaMemberMap);
    assert.equal(ops.length, 3);

    const ids = ops.map((o) => o.authorId);
    assert.ok(ids.includes(101));
    assert.ok(ids.includes(102));
    assert.ok(ids.includes(103));

    const op101 = ops.find((o) => o.authorId === 101);
    assert.equal(op101.commentCount, 2);

    const op102 = ops.find((o) => o.authorId === 102);
    assert.equal(op102.commentCount, 1);
  });

  it("should fallback gracefully if member details not in memberMap", () => {
    const comments = [
      { id: 1, incident_id: 502, author_id: 101, author_name: "Usuario Fallback", created_at: 1000, message: "Test" },
    ];
    const ops = extractCommentingOperators(comments, mdaMemberIdSet, new Map());
    assert.equal(ops.length, 1);
    assert.equal(ops[0].authorId, 101);
    assert.equal(ops[0].authorName, "Usuario Fallback");
  });

  it("should exclude ticket creator from commenting operators list", () => {
    const comments = [
      { id: 1, incident_id: 503, author_id: 101, author_name: "jperez", created_at: 1000, message: "Nota creador" },
      { id: 2, incident_id: 503, author_id: 102, author_name: "mgomez", created_at: 1020, message: "Paso 2" },
    ];
    const creatorId = 101;
    const ops = extractCommentingOperators(comments, mdaMemberIdSet, mdaMemberMap).filter((o) => o.authorId !== creatorId);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].authorId, 102);
    assert.equal(ops[0].commentCount, 1);
  });
});
