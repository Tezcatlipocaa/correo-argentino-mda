import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MODEL_C_FAMILIES,
  ACTION_PLANS,
} from "./model-c-catalog";

describe("Catálogo Canónico de Propuesta C", () => {
  test("debe contener exactamente 10 familias canónicas", () => {
    assert.equal(MODEL_C_FAMILIES.length, 10);
  });

  test("todas las familias deben tener identificadores, nombres, iconos y descripción válidos", () => {
    const ids = new Set<string>();

    for (const family of MODEL_C_FAMILIES) {
      assert.ok(family.id && family.id.trim().length > 0, `ID inválido para familia ${family.name}`);
      assert.ok(family.name && family.name.trim().length > 0, `Nombre inválido para familia ${family.id}`);
      assert.ok(family.icon && family.icon.startsWith("bx:"), `Ícono inválido o formato incorrecto: ${family.icon}`);
      assert.ok(family.description && family.description.length > 10, `Descripción insuficiente para ${family.name}`);
      assert.ok(family.systemsCount > 0, `systemsCount debe ser mayor a 0 para ${family.name}`);
      assert.ok(!ids.has(family.id), `ID duplicado: ${family.id}`);
      ids.add(family.id);
    }
  });

  test("las familias deben coincidir con la taxonomía documentada", () => {
    const expectedNames = [
      "Aplicaciones de Distribucion",
      "Aplicaciones Comerciales",
      "Aplicaciones Web y de Escritorio",
      "Aplicaciones Administrativas",
      "Impresion",
      "Equipos de trabajo",
      "Moviles",
      "Redes y Telefonia",
      "Entidades externas",
      "Edificios y traslados",
    ];

    const currentNames = MODEL_C_FAMILIES.map((f) => f.name);
    assert.deepEqual(currentNames, expectedNames);
  });
});

describe("Planes de Acción de Propuesta C", () => {
  test("resumen de nodos muertos debe coincidir con la auditoría (165 totales, 148 hojas, 17 ramas)", () => {
    assert.equal(ACTION_PLANS.deadNodesSummary.totalDeadNodes, 165);
    assert.equal(ACTION_PLANS.deadNodesSummary.deadLeaves, 148);
    assert.equal(ACTION_PLANS.deadNodesSummary.emptyBranches, 17);
  });

  test("atajos de resolución inmediata deben ser 19 y apuntar a 3 selecciones", () => {
    assert.equal(ACTION_PLANS.immediateShortcuts.length, 19);

    for (const shortcut of ACTION_PLANS.immediateShortcuts) {
      assert.ok(shortcut.name && shortcut.name.length > 0);
      assert.ok(shortcut.tickets > 0, `Tickets debe ser positivo en ${shortcut.name}`);
      assert.ok(shortcut.immediatePercent > 0 && shortcut.immediatePercent <= 100);
      assert.ok(shortcut.currentSelections >= 3);
      assert.equal(shortcut.targetSelections, 3);
    }
  });

  test("fusión de homónimos debe contemplar 35 grupos, 64 categorías y 442 tickets", () => {
    assert.equal(ACTION_PLANS.homonymMergers.length, 35);

    const totalCategories = ACTION_PLANS.homonymMergers.reduce(
      (sum, group) => sum + group.categoriesCount,
      0,
    );
    assert.equal(totalCategories, 64);

    const totalTickets = ACTION_PLANS.homonymMergers.reduce(
      (sum, group) => sum + group.totalTickets,
      0,
    );
    assert.equal(totalTickets, 442);

    for (const group of ACTION_PLANS.homonymMergers) {
      assert.ok(group.targetName && group.targetName.length > 0);
      assert.equal(group.absorbedCategories.length, group.categoriesCount);
      const subTickets = group.absorbedCategories.reduce((s, c) => s + c.tickets, 0);
      assert.equal(subTickets, group.totalTickets);
    }
  });
});
