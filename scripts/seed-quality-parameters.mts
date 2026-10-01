import { db } from "../src/db/index.js";
import { auditParameters } from "../src/db/schema.js";
import {
  WISE_CALL_PARAMETERS,
  WISE_EMAIL_PARAMETERS,
  INVGATE_AG_PARAMETERS,
} from "../src/config/qualityParams.js";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("=== Sembrando parámetros de calidad multi-canal ===");

  const allParams = [
    ...WISE_CALL_PARAMETERS,
    ...WISE_EMAIL_PARAMETERS,
    ...INVGATE_AG_PARAMETERS,
  ];

  let inserted = 0;
  let updated = 0;

  for (const p of allParams) {
    const existing = db
      .select()
      .from(auditParameters)
      .where(sql`${auditParameters.code} = ${p.code}`)
      .get();

    if (existing) {
      db.update(auditParameters)
        .set({
          name: p.name,
          weight: p.weight,
          category: p.section === "items" ? "Items" : p.section === "ticket" ? "Ticket" : "MDA",
          channel: p.channel,
          section: p.section,
          order: p.order,
          active: true,
        })
        .where(sql`${auditParameters.id} = ${existing.id}`)
        .run();
      updated++;
    } else {
      db.insert(auditParameters)
        .values({
          code: p.code,
          name: p.name,
          weight: p.weight,
          category: p.section === "items" ? "Items" : p.section === "ticket" ? "Ticket" : "MDA",
          channel: p.channel,
          section: p.section,
          order: p.order,
          active: true,
        })
        .run();
      inserted++;
    }
  }

  console.log(`Parámetros procesados: ${allParams.length} (Insertados: ${inserted}, Actualizados: ${updated})`);
}

seed().catch(console.error);
