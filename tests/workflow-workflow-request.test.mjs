import { parseWorkflowInitialFields } from "../src/lib/invgate/automation/workflow-request";

/**
 * Parser de los initial fields del workflow (/wf.request). El shape se basa en
 * el manual de InvGate (steps → executions → fields); en la instancia v8.21.7
 * el endpoint da 404, así que este test cubre el parseo con un fixture.
 *
 * Ejecución: node --import tsx tests/workflow-workflow-request.test.mjs
 */

const failures = [];
function check(name, condition) {
  if (!condition) {
    failures.push(`FAIL: ${name}`);
  } else {
    console.log(`ok - ${name}`);
  }
}

const request = {
  steps: [
    {
      id: "start",
      name: "Datos de la solicitud",
      executions: [
        {
          fields: [
            { label: "NIS", value: "1234567", value_label: "" },
            {
              label: "Jefe de Sucursal",
              value: 4511,
              value_label: "Mónica Ávila",
            },
            { label: "Jefe Zonal", value: 999, value_label: "Juan Pérez" },
            {
              label: "Jefe de Sucursal",
              value:
                "<table><tbody><tr><td>DNI</td><td>24430010</td></tr><tr><td>N° Legajo</td><td>33375</td></tr></tbody></table>",
              value_label: "",
            },
          ],
        },
      ],
    },
  ],
};

const parsed = parseWorkflowInitialFields(request);
check("devuelve un resultado", parsed !== null);
check("nombre del jefe de sucursal", parsed?.jefeName === "Mónica Ávila");
check("DNI desde la tabla", parsed?.jefeDni === "24430010");
check("legajo desde la tabla", parsed?.jefeLegajo === "33375");
check("nombre del jefe zonal", parsed?.jefeZonal === "Juan Pérez");
check("NIS", parsed?.nis === "1234567");

check("null ante request nulo", parseWorkflowInitialFields(null) === null);
check(
  "null cuando no hay campos útiles",
  parseWorkflowInitialFields({ steps: [] }) === null,
);
check(
  "acepta variables como respaldo",
  (() => {
    const r = parseWorkflowInitialFields({
      variables: [{ name: "Jefe Zonal", value: "", value_label: "Ana Gómez" }],
    });
    return r?.jefeZonal === "Ana Gómez";
  })(),
);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("workflow-workflow-request: all checks passed");
