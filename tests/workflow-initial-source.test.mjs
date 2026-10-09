import "dotenv/config";
import {
  parseInitialForm,
  parseSucursalValue,
} from "../src/lib/workflow/initial-form";
import {
  parseInstalacionesDescription,
  toParsedInitialForm,
} from "../src/lib/workflow/instalaciones-form";
import {
  chooseInitialForm,
  hasSubstantiveForm,
} from "../src/lib/workflow/initial-source";

/**
 * Verificación unitaria de la elección de fuente del formulario inicial
 * (casos reales B0177, B1046). Ejecución:
 *   npx tsx tests/workflow-initial-source.test.mjs
 */

const failures = [];
const check = (name, condition) => {
  if (condition) {
    console.log(`ok ${name}`);
  } else {
    failures.push(`FAIL ${name}`);
  }
};

const WEAK_COMMENT =
  "Se vincula tarea para despacho de Multitoma (Zapatilla): #85967";

const INSTALACIONES_B0177 =
  "Se solicita programar instalaciones para el día 1 oct 2026 en Sucursal " +
  "Metro » BA » Moreno » FRANCISCO ALVAREZ - AGE GIROS (B0177) " +
  "La Nacion Diario 2052 (B1746FND) CC_71025342, Jefe de Sucursal " +
  "Leandro Agustin Perez";

const INSTALACIONES_B1046 =
  "Se solicita programar instalaciones para el día 15 oct 2026 en Sucursal " +
  "Metro » BA » Lomas De Zamora » TRIBUNALES DE BANFIELD - AGE POSTAL (B1046) " +
  "Larroque Alberto 2450 (B1828HQX) CC_71025453, Jefe de Sucursal " +
  "Romina Elizabeth Vallve";

const DESCRIPTION_B0061 =
  "Se genera solicitud por automatización de sucursal.\n" +
  "Sucursal: Metro » BA » Ezeiza » AEROPUERTO EZEIZA - AGE GIROS (B0061) " +
  "Riccheri Teniente General Pablo 0 (B1802ADA) CC_71025301";

function instalacionesCandidate(text, tag) {
  const info = parseInstalacionesDescription(text);
  return info
    ? { parsed: toParsedInitialForm(info), source: { tag } }
    : null;
}

// hasSubstantiveForm: un comentario con "label: valor" no es sustantivo.
const weakParsed = parseInitialForm(WEAK_COMMENT);
check("comentario débil no sustantivo", !hasSubstantiveForm(weakParsed));
check(
  "description con sucursal es sustantiva",
  hasSubstantiveForm(parseInitialForm(DESCRIPTION_B0061)),
);

// B0177: descripción vacía + comentario débil + hijo Instalaciones con sucursal.
const b0177 = chooseInitialForm({
  description: null,
  comment: { parsed: weakParsed, source: { tag: "comment" } },
  instalaciones: instalacionesCandidate(INSTALACIONES_B0177, "instalaciones"),
});
check("B0177 elige el hijo Instalaciones", b0177?.source.tag === "instalaciones");
check(
  "B0177 sucursal Francisco Alvarez",
  b0177?.parsed?.sucursal?.name === "Francisco Alvarez",
);

// B1046: sin descripción ni comentario, el hijo Instalaciones gana.
const b1046 = chooseInitialForm({
  description: null,
  comment: null,
  instalaciones: instalacionesCandidate(INSTALACIONES_B1046, "instalaciones"),
});
check("B1046 elige el hijo Instalaciones", b1046?.source.tag === "instalaciones");
check(
  "B1046 sucursal Tribunales de Banfield",
  b1046?.parsed?.sucursal?.name === "Tribunales de Banfield",
);

// Caso normal: description sustantiva gana aunque exista el hijo.
const normal = chooseInitialForm({
  description: {
    parsed: parseInitialForm(DESCRIPTION_B0061),
    source: { tag: "description" },
  },
  comment: null,
  instalaciones: instalacionesCandidate(INSTALACIONES_B0177, "instalaciones"),
});
check("description sustantiva gana", normal?.source.tag === "description");
check(
  "description conserva su sucursal",
  normal?.parsed?.sucursal?.name === "Aeropuerto Ezeiza",
);

// Código de sucursal no-B (colegio): "(C4932)" se reconoce igual que "(B####)".
const sucursalC = parseSucursalValue(
  "Metro » BA » La Plata » COLEGIO DE ABOGADOS - AGE GIROS (C4932) " +
    "Calle 13 1234 (B1900ABC) CC_71025999",
);
check(
  "sucursal con código C: nombre",
  sucursalC.name === "Colegio de Abogados",
);
check(
  "sucursal con código C: dirección",
  sucursalC.address === "Calle 13 1234",
);
check("sucursal con código C: CPA", sucursalC.cpa === "1900ABC");

// Sin ninguna fuente no rompe.
check(
  "sin fuentes devuelve null",
  chooseInitialForm({ description: null, comment: null, instalaciones: null }) ===
    null,
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-initial-source: all checks passed");
