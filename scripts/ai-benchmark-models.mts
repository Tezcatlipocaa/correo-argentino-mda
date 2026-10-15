import { db } from "../src/db/index.js";
import { qualityAudits, auditScores, auditParameters } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { fetchInvgateTicketMetadata } from "../src/lib/qualityMetadataFetcher.js";
import { evaluateWithAi } from "../src/lib/qualityAiEvaluator.js";
import type { ChannelType } from "../src/types/quality.js";

interface BenchmarkResult {
  model: string;
  totalTested: number;
  successfulEvaluations: number;
  totalLatencySec: number;
  agreementCount: number;
  totalComparedCriteria: number;
}

const DEFAULT_MODELS = [
  "opencode/nemotron-3.5-lightning-free",
  "opencode/deepseek-v4.1-flash-free",
];

async function runBenchmark() {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf("--limit");
  const limit = limitArgIdx !== -1 && args[limitArgIdx + 1] ? parseInt(args[limitArgIdx + 1], 10) : 3;

  console.log(`\n========================================================================`);
  console.log(`🚀 MDA - Benchmark de Modelos IA para Auditorías de Calidad`);
  console.log(`========================================================================`);
  console.log(`Muestra: hasta ${limit} auditorías con ticket InvGate registrado.\n`);

  // 1. Obtener auditorías con ticketId no nulo
  const audits = await db
    .select({
      id: qualityAudits.id,
      ticketId: qualityAudits.ticketId,
      channelType: qualityAudits.channelType,
      agentId: qualityAudits.agentId,
      totalScore: qualityAudits.totalScore,
    })
    .from(qualityAudits)
    .where(eq(qualityAudits.ticketId, qualityAudits.ticketId))
    .limit(limit * 3);

  const validAudits = audits.filter((a) => a.ticketId && /^\d+$/.test(a.ticketId.trim())).slice(0, limit);

  let targetAudits = validAudits;

  if (targetAudits.length === 0) {
    console.log("⚠️ No se encontraron auditorías históricas con ticket InvGate en database/mda.db.");
    console.log("👉 Ejecutando benchmark con caso de prueba representativo (Simulado con Rúbricas Maestras)...\n");
    targetAudits = [
      {
        id: 999999,
        ticketId: "SIM-88412",
        channelType: "wise_call",
        agentId: 1,
        totalScore: 100,
      },
    ];
  }

  console.log(`Auditorías seleccionadas para el benchmark: ${targetAudits.length}`);

  const results: Record<string, BenchmarkResult> = {};

  for (const model of DEFAULT_MODELS) {
    results[model] = {
      model,
      totalTested: 0,
      successfulEvaluations: 0,
      totalLatencySec: 0,
      agreementCount: 0,
      totalComparedCriteria: 0,
    };
  }

  for (const audit of targetAudits) {
    const ticketId = audit.ticketId!.trim();
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`📋 Audit ID #${audit.id} | Ticket InvGate #${ticketId} | Canal: ${audit.channelType}`);
    console.log(`------------------------------------------------------------------------`);

    // Obtener metadatos de InvGate
    const [metaRes, rawRes] = await Promise.all([
      fetchInvgateTicketMetadata(ticketId),
      fetchInvgateTicketMetadata(ticketId, { includeRaw: true }),
    ]);

    let metaData = metaRes.data;
    let rawData = rawRes.data?.raw;

    if (!metaRes.ok || !metaData) {
      console.log(`  ⚠️ InvGate no disponible (${metaRes.error}). Usando datos de auditoría local simulada.`);
      metaData = {
        caseNumber: ticketId,
        title: "Problema al imprimir en sucursal",
        description: "El operador asiste al usuario con atasco de papel en impresora de puesto 2.",
        category: "Hardware > Impresoras",
        priority: "Media",
        status: "Solucionado",
        source: "Teléfono",
        helpdesk: "Mesa de Ayuda TI",
        customer: "Usuario Local",
        createdBy: "Operador",
        operator: "Operador",
        creationTime: "2026-10-01 10:00:00",
        takeTime: "00:02:30",
        rawDetails: {},
      };
      rawData = {
        comments: [
          { created_at: "2026-10-01 10:05", message: "Se solicita al usuario destrabar bandeja trasera." },
          { created_at: "2026-10-01 10:15", message: "Impresora operativa. Se cierra caso." },
        ],
      };
    }

    // Obtener los scores históricos del supervisor humano
    const humanScores = await db
      .select({
        score: auditScores.score,
        code: auditParameters.code,
      })
      .from(auditScores)
      .leftJoin(auditParameters, eq(auditParameters.id, auditScores.parameterId))
      .where(eq(auditScores.auditId, audit.id));

    const humanScoreMap = new Map<string, boolean>();
    for (const hs of humanScores) {
      if (hs.code) humanScoreMap.set(hs.code, !!hs.score);
    }

    for (const model of DEFAULT_MODELS) {
      process.stdout.write(`  ⏳ Probando [${model}]... `);
      const start = Date.now();
      results[model].totalTested++;

      try {
        const evalRes = await evaluateWithAi(
          audit.channelType as ChannelType,
          metaData,
          rawData,
          { model, provider: "opencode" },
        );

        const elapsedSec = (Date.now() - start) / 1000;
        results[model].totalLatencySec += elapsedSec;
        results[model].successfulEvaluations++;

        let matches = 0;
        let compared = 0;

        for (const verdict of evalRes.verdicts) {
          if (humanScoreMap.has(verdict.codigo) && verdict.cumple !== null) {
            compared++;
            const humanVal = humanScoreMap.get(verdict.codigo);
            if (humanVal === verdict.cumple) {
              matches++;
            }
          }
        }

        results[model].agreementCount += matches;
        results[model].totalComparedCriteria += compared;

        console.log(`OK (${elapsedSec.toFixed(1)}s) | ${evalRes.verdicts.length} criterios | Coincidencia: ${matches}/${compared}`);
        if (evalRes.resumen) {
          console.log(`     Resumen: "${evalRes.resumen.slice(0, 100)}..."`);
        }
      } catch (err) {
        console.log(`FALLÓ: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n========================================================================`);
  console.log(`📊 TABLA COMPARATIVA DE MODELOS`);
  console.log(`========================================================================\n`);

  console.table(
    Object.values(results).map((r) => {
      const avgLat = r.successfulEvaluations > 0 ? (r.totalLatencySec / r.successfulEvaluations).toFixed(1) + "s" : "N/A";
      const agreementPct = r.totalComparedCriteria > 0 ? Math.round((r.agreementCount / r.totalComparedCriteria) * 100) + "%" : "N/A";
      const successRate = r.totalTested > 0 ? Math.round((r.successfulEvaluations / r.totalTested) * 100) + "%" : "0%";

      return {
        Modelo: r.model.replace("opencode/", ""),
        "Evaluaciones OK": `${r.successfulEvaluations}/${r.totalTested} (${successRate})`,
        "Latencia Promedio": avgLat,
        "Coincidencia Supervisor": `${r.agreementCount}/${r.totalComparedCriteria} (${agreementPct})`,
      };
    }),
  );
}

runBenchmark().catch((err) => {
  console.error("Error fatal en benchmark:", err);
  process.exit(1);
});
