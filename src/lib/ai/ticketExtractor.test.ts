import test from "node:test";
import assert from "node:assert/strict";
import { extractTicketReferences } from "./ticketExtractor.js";

test("extractTicketReferences: extrae ticket con palabra clave 'ticket' o 'incidente'", () => {
  const text = "El usuario se comunica por el ticket 90688 que abrió la semana pasada.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 1);
  assert.equal(res[0].ticketId, "90688");
  assert.equal(res[0].type, "previo");
});

test("extractTicketReferences: clasifica como 'nuevo' si el operador informa asignación", () => {
  const text = "Le genero el incidente 544637 para que el área técnica lo revise.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 1);
  assert.equal(res[0].ticketId, "544637");
  assert.equal(res[0].type, "nuevo");
});

test("extractTicketReferences: soporta tickets de 7 dígitos con prefijo numeral", () => {
  const text = "Quedó registrado bajo el número #1025489 correctamente.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 1);
  assert.equal(res[0].ticketId, "1025489");
  assert.equal(res[0].type, "nuevo");
});

test("extractTicketReferences: no confunde números de teléfono argentinos con tickets", () => {
  const text = "Me pueden llamar al 1145678901 o al 08002221234 en cualquier momento.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 0, "No debe capturar números de teléfono");
});

test("extractTicketReferences: no confunde DNI ni CUIL con tickets", () => {
  const text = "Mi DNI es 38123456 y el cuil 20-38123456-2. Mi legajo es 1234567.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 0, "No debe capturar DNI, CUIL ni legajos");
});

test("extractTicketReferences: no confunde años ni fechas con tickets", () => {
  const text = "Esto ocurre desde el 2026. La fecha del problema fue 17/10/2026.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 0, "No debe capturar años ni fechas");
});

test("extractTicketReferences: no confunde direcciones IP con tickets", () => {
  const text = "Realizamos ping a la IP 10.200.34.120 y respondió con éxito.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 0, "No debe capturar IPs");
});

test("extractTicketReferences: deduplica menciones repetidas del mismo ticket", () => {
  const text = "El ticket 90688 sigue abierto. Reitero que el ticket 90688 no tuvo solución.";
  const res = extractTicketReferences(text);
  assert.equal(res.length, 1);
  assert.equal(res[0].ticketId, "90688");
});

test("extractTicketReferences: maneja textos vacíos o sin números limpiamente", () => {
  assert.deepEqual(extractTicketReferences(""), []);
  assert.deepEqual(extractTicketReferences("Hola buenas tardes, necesito ayuda con mi clave."), []);
});
