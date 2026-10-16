import test from "node:test";
import assert from "node:assert/strict";
import {
  splitCriteriaByAgent,
  mergeCouncil,
  buildJudgePrompt,
  type AgentVerdictMap,
} from "./councilEvaluator.js";
import { getAiCriteria } from "../qualityAiEvaluator.js";
import { CHANNEL_TYPES } from "../../types/quality.js";

test("cobertura de buckets: todo criterio de getAiCriteria() para los 3 canales cae en Alpha o Beta (sin huérfanos)", () => {
  for (const channel of CHANNEL_TYPES) {
    const criteria = getAiCriteria(channel);
    const { alpha, beta } = splitCriteriaByAgent(criteria);
    const mappedCount = alpha.length + beta.length;
    assert.equal(
      mappedCount,
      criteria.length,
      `Canal ${channel}: se esperaban ${criteria.length} criterios mapeados, pero se obtuvieron ${mappedCount}`,
    );

    // Verificar que 'descripcion' caiga en Beta y no quede huérfana
    const hasDescripcion = criteria.some((c) => c.code.endsWith("descripcion"));
    if (hasDescripcion) {
      assert.ok(
        beta.some((c) => c.code.endsWith("descripcion")),
        `Canal ${channel}: el criterio de descripción debe estar asignado a Beta`,
      );
    }
  }
});

test("mergeCouncil: dos null devuelven directo + sin_evidencia (sin discrepancia)", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_a: {
      codigo: "criterio_a",
      cumple: null,
      confianza: 0.5,
      evidencia: "",
      razonamiento: "No hay datos",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_a: {
      codigo: "criterio_a",
      cumple: null,
      confianza: 0.5,
      evidencia: "",
      razonamiento: "Sin evidencia",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_a"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].codigo, "criterio_a");
  assert.equal(resolved[0].cumple, null);
  assert.equal(resolved[0].consenso, "directo");
  assert.equal(resolved[0].motivo, "sin_evidencia");
});

test("mergeCouncil: mismo cumple con confianzas >= 0.85 devuelve directo con min(confianza)", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_b: {
      codigo: "criterio_b",
      cumple: true,
      confianza: 0.95,
      evidencia: "Solución aplicada correctamente",
      razonamiento: "Cumple rúbrica",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_b: {
      codigo: "criterio_b",
      cumple: true,
      confianza: 0.88,
      evidencia: "Se documentó la solución",
      razonamiento: "El usuario aprobó",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_b"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].cumple, true);
  assert.equal(resolved[0].confianza, 0.88);
  assert.equal(resolved[0].consenso, "directo");
  assert.equal(resolved[0].motivo, "acuerdo_alto");
});

test("mergeCouncil: mismo cumple pero confianza < 0.85 pasa a disputa para el Juez", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_c: {
      codigo: "criterio_c",
      cumple: true,
      confianza: 0.9,
      evidencia: "Ok",
      razonamiento: "Bien",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_c: {
      codigo: "criterio_c",
      cumple: true,
      confianza: 0.7,
      evidencia: "Dudoso",
      razonamiento: "Falta claridad",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_c"], alphaMap, betaMap);
  assert.equal(resolved.length, 0);
  assert.equal(disputes.length, 1);
  assert.equal(disputes[0].codigo, "criterio_c");
  assert.equal(disputes[0].motivo, "baja_confianza");
});

test("mergeCouncil: veredictos opuestos (true vs false o null vs true) pasan a disputa", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_d: {
      codigo: "criterio_d",
      cumple: true,
      confianza: 0.9,
      evidencia: "Documentado",
      razonamiento: "Explicó los pasos",
    },
  };
  const betaMap: AgentVerdictMap = {
    criterio_d: {
      codigo: "criterio_d",
      cumple: false,
      confianza: 0.85,
      evidencia: "Incompleto",
      razonamiento: "Faltó captura",
    },
  };

  const { resolved, disputes } = mergeCouncil(["criterio_d"], alphaMap, betaMap);
  assert.equal(resolved.length, 0);
  assert.equal(disputes.length, 1);
  assert.equal(disputes[0].codigo, "criterio_d");
  assert.equal(disputes[0].motivo, "discrepancia_cumple");
});

test("mergeCouncil: si un bucket estuvo ausente o falló, se resuelve sin_oposicion sin invocar al juez", () => {
  const alphaMap: AgentVerdictMap = {
    criterio_e: {
      codigo: "criterio_e",
      cumple: true,
      confianza: 0.9,
      evidencia: "Solo Alpha",
      razonamiento: "Solo evaluado por Alpha",
    },
  };
  const betaMap: AgentVerdictMap = {};

  const { resolved, disputes } = mergeCouncil(["criterio_e"], alphaMap, betaMap);
  assert.equal(disputes.length, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].consenso, "sin_oposicion");
  assert.equal(resolved[0].cumple, true);
});

test("buildJudgePrompt genera un prompt quirúrgico conciso (< 500 tokens por disputa)", () => {
  const prompt = buildJudgePrompt([
    {
      codigo: "call_ticket_procedimiento",
      criterioNombre: "Procedimiento y Derivación",
      rubrica: "Debe derivar a MDA Nivel 2 solo con diagnóstico previo.",
      alphaVote: {
        codigo: "call_ticket_procedimiento",
        cumple: true,
        confianza: 0.85,
        evidencia: "Hizo ping a la IP",
        razonamiento: "Realizó diagnóstico antes de derivar",
      },
      betaVote: {
        codigo: "call_ticket_procedimiento",
        cumple: false,
        confianza: 0.9,
        evidencia: "No adjuntó captura",
        razonamiento: "El procedimiento exige captura de pantalla",
      },
      motivo: "discrepancia_cumple",
    },
  ]);

  assert.ok(prompt.includes("call_ticket_procedimiento"));
  assert.ok(prompt.includes("Postura Agente Alpha"));
  assert.ok(prompt.includes("Postura Agente Beta"));
  assert.ok(prompt.length < 2500); // Conciso (< 500 tokens)
});
