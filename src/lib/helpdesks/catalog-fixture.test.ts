import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HELPDESKS_FIXTURE } from "./catalog-fixture";

describe("Catálogo Canónico de Mesas (HELPDESKS_FIXTURE)", () => {
  test("debe contener al menos 6 mesas corporativas", () => {
    assert.ok(HELPDESKS_FIXTURE.length >= 6);
  });

  test("debe incluir Mesa de Ayuda TI como mesa principal con métricas esperadas", () => {
    const mainMda = HELPDESKS_FIXTURE.find((item) => item.isMainMda);
    assert.ok(mainMda !== undefined);
    assert.equal(mainMda.id, 1);
    assert.equal(mainMda.name, "Mesa de Ayuda TI");
    assert.equal(mainMda.displayName, "Central MDA Nivel 1");
    assert.equal(mainMda.isMainMda, true);
    assert.ok(mainMda.incomingTicketsMonth > 10000);
    assert.ok(mainMda.csat.averageRating >= 4.0);
  });

  test("todas las mesas deben tener identificadores únicos y datos obligatorios válidos", () => {
    const ids = new Set<number>();

    for (const item of HELPDESKS_FIXTURE) {
      assert.ok(item.id > 0);
      assert.ok(!ids.has(item.id));
      ids.add(item.id);
      assert.ok(item.name.trim().length > 0);
      assert.ok(item.displayName.trim().length > 0);
      assert.ok(item.totalMembers > 0);
      assert.ok(item.incomingTicketsMonth > 0);
      assert.ok(item.resolvedTicketsMonth > 0);
      assert.ok(item.inOutRatio > 0);
    }
  });

  test("todas las mesas deben tener una suma de backlog consistente (active + waiting + closed === total)", () => {
    for (const item of HELPDESKS_FIXTURE) {
      const calculatedTotal = item.backlog.active + item.backlog.waiting + item.backlog.closed;
      assert.equal(
        calculatedTotal,
        item.backlog.total,
        `Inconsistencia en backlog total para ${item.name}: ${calculatedTotal} !== ${item.backlog.total}`,
      );
    }
  });

  test("los porcentajes de sentimiento CSAT deben sumar exactamente 100%", () => {
    for (const item of HELPDESKS_FIXTURE) {
      const sentimentSum =
        item.csat.positiveSentimentPercent +
        item.csat.neutralSentimentPercent +
        item.csat.negativeSentimentPercent;
      assert.equal(
        sentimentSum,
        100,
        `Suma de sentimiento CSAT incorrecta para ${item.name}: ${sentimentSum} !== 100`,
      );
    }
  });
});
