import { parseInstalacionesDescription } from "../src/lib/workflow/instalaciones-form";

/**
 * Parser de la prosa de los hijos "Instalaciones"/"TECO Instalaciones".
 * Cubre el formato nuevo, donde el nombre del jefe viene seguido de más texto
 * en la misma línea ("… Detalle de equipamiento …").
 * Ejecución: node --import tsx tests/workflow-instalaciones-form.test.mjs
 */

const failures = [];
function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

const nuevo = parseInstalacionesDescription(
  "Se solicita gestionar el acondicionamiento de redes y cableado para las instalaciones programadas para el día 6 oct 2026 en Sucursal Metro » BA » Almirante Brown » GLEW - AGE GIROS (B0101) Sarmiento 50 (B1856CJB) CC_71025354 , Jefe de Sucursal\u00a0Veronica Sotelo Detalle de equipamiento #Actual #Final Servidor MOA y HandHeld 2 Terminal",
);
check(
  "formato nuevo: nombre del jefe aislado",
  nuevo?.jefeName === "Veronica Sotelo",
);
check("formato nuevo: fecha programada", nuevo?.scheduledDate === "6 oct 2026");

const viejo = parseInstalacionesDescription(
  "Se solicita programar instalaciones para el día 24 sep 2026 en Sucursal Metro » BA » Esteban Echeverria » LUIS GUILLON - SUC GIROS (B0106) Buenos Aires 1758 (B1838AHU) CC_71025399, Jefe de Sucursal Monica Avila",
);
check("formato viejo: nombre al final", viejo?.jefeName === "Monica Avila");

const tresPalabras = parseInstalacionesDescription(
  "Jefe de Sucursal: Leticia Alejandra Lugones",
);
check(
  "nombre de 3 palabras",
  tresPalabras?.jefeName === "Leticia Alejandra Lugones",
);

const cuatroConStop = parseInstalacionesDescription(
  "Jefe de Sucursal Julian Diego Della Villa Horario: 10 a 17hs",
);
check(
  "corta en stopword (Horario)",
  cuatroConStop?.jefeName === "Julian Diego Della Villa",
);

const sinJefe = parseInstalacionesDescription(
  "Texto genérico sin datos de instalaciones ni de sucursal",
);
check("sin sucursal ni jefe devuelve null", sinJefe === null);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-instalaciones-form: all checks passed");
