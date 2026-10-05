import {
  normalizeTitleName,
  applyTitleCase,
  applyAccents,
  formatTitleName,
} from "../src/lib/titleFormat";

/**
 * Normalización del formato de títulos (guion separador con espacios).
 * Ejecución: npx tsx tests/title-format.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures.push(`FAIL - ${name}`);
  }
};

const eq = (input, expected) =>
  check(
    `${JSON.stringify(input)} -> ${JSON.stringify(expected)}`,
    normalizeTitleName(input) === expected,
  );

eq("Boca de red- Habilitación", "Boca de red - Habilitación");
eq("CallCenter Giros- Instalacion", "CallCenter Giros - Instalacion");
eq("red -Habilitación", "red - Habilitación");
eq("MFA-Consulta operativa", "MFA - Consulta operativa");
eq("MFA-Reset QR", "MFA - Reset QR");

// Idempotencia: ya correctos no cambian.
eq("Boca de red - Habilitación", "Boca de red - Habilitación");
eq("Mosaic - Configuración", "Mosaic - Configuración");

// Compuestas legítimas se preservan.
eq("Wi-Fi", "Wi-Fi");
eq("E-mail corporativo", "E-mail corporativo");

// Sin guion no cambia.
eq("Alta de usuario", "Alta de usuario");

// Sentence case del lado derecho (el izquierdo intacto).
const caseEq = (input, expected) =>
  check(
    `case ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`,
    applyTitleCase(input) === expected,
  );

caseEq("Canal Directo - Solicitud de Técnico", "Canal Directo - Solicitud de técnico");
caseEq("HH - Equipo Dañado", "HH - Equipo dañado");
caseEq("Enlace - Analisis de RED", "Enlace - Analisis de RED");
caseEq("Enlace - Acceso a RED WIFI", "Enlace - Acceso a RED WIFI");
caseEq("Cierre - CDD (Nombre de Sitio/Depto)", "Cierre - CDD (Nombre de Sitio/Depto)");
caseEq(
  "Mosaic - Configuración carpeta de escaneos BUI",
  "Mosaic - Configuración carpeta de escaneos BUI",
);
caseEq("MFA - Reset QR", "MFA - Reset QR");
caseEq("GYT - No Responde", "GYT - No responde");
// Izquierda intacta (marca en mayúsculas).
caseEq("MS Teams - Redirige a Webmail", "MS Teams - Redirige a webmail");

// Acentos (curada; no tilda "solicitud").
const accEq = (input, expected) =>
  check(
    `acentos ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`,
    applyAccents(input) === expected,
  );
accEq("Celular - Configuracion", "Celular - Configuración");
accEq("Boca de red - Instalacion", "Boca de red - Instalación");
accEq("Enlace - Revision de Cableado", "Enlace - Revisión de Cableado");
accEq("Línea - Telefono analogico sin tono", "Línea - Teléfono analogico sin tono");
accEq("Solicitud de Toner", "Solicitud de Toner");
accEq("Configuración", "Configuración");

// Pipeline final.
const fmt = (input, expected) =>
  check(
    `format ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`,
    formatTitleName(input) === expected,
  );
fmt("Celular- Configuracion", "Celular - Configuración");
fmt("Canal Directo - Solicitud de Técnico", "Canal Directo - Solicitud de técnico");
fmt("Boca de red - Instalacion", "Boca de red - Instalación");
// Idempotencia del pipeline.
fmt("Celular - Configuración", "Celular - Configuración");
fmt("Canal Directo - Solicitud de técnico", "Canal Directo - Solicitud de técnico");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("title-format: all checks passed");
