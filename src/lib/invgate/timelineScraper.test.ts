import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInvgateTimelineHtml, isInvgateLoginPage, isRelevantTimelineLog } from "./timelineScraper";

const SAMPLE_INVGATE_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="request-view__activity activity" id="history">
    <div id="responseForm">
      <div class="activity-item activity-message activity-message--form">
        <textarea>Escriba una respuesta aquí...</textarea>
      </div>
    </div>

    <div class="activity-item activity-log">
      <div class="activity-log__icon fa fa-sync-alt"></div>
      <div class="activity-log__content"><span class="author"><a class="profile-link" data-user-id="469">C. Cuello</a><script>showUserMiniProfile(this,469);</script></span> cambió el estado de <span class="before">En espera</span> a <span class="after">Solucionado</span></div>
      <div class="activity-log__expander"></div>
      <div class="activity-item__date activity-log__date">
        <span data-timestamp="1791993145" data-timestamp-group="history" data-timestamp-switch="14 oct. 2026, 12:52">hace un día</span>
      </div>
    </div>

    <div class="activity-item activity-message activity-message--solution">
      <div class="activity-message__content">
        <div class="activity-message__labels">
          <div class="activity-message__label activity-item__date activity-message__date">
            <span data-timestamp="1791993145" data-timestamp-switch="14 oct. 2026, 12:52">hace un día</span>
          </div>
          <div class="activity-message__label activity-message__label--green">Solución</div>
        </div>
        <div class="activity-message__message">
          <div class="activity-message__user-reply">
            <div class="activity-message__user"><a class="profile-link">Camila Cuello</a><script>evil();</script></div>
          </div>
          <div class="activity-message__text">
            <p><a data-mention="2294">@L. L. Castillo</a>&nbsp;se le indica que no hay problemas en el HOST/netterm.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="activity-item activity-message activity-message--private">
      <div class="activity-message__content">
        <div class="activity-message__labels">
          <div class="activity-message__label activity-item__date activity-message__date">
            <span data-timestamp="1791991702" data-timestamp-switch="14 oct. 2026, 12:28">hace un día</span>
          </div>
        </div>
        <div class="activity-message__message">
          <div class="activity-message__user"><a class="profile-link">Camila Cuello</a></div>
          <div class="activity-message__text">
            <p>Haciendo ping a b0044w103 [10.245.196.103]: recibidos = 3, perdidos = 0</p>
          </div>
        </div>
      </div>
    </div>

    <div class="activity-item activity-log">
      <div class="activity-log__icon fa fa-sync-alt"></div>
      <div class="activity-log__content">
        <span class="author"><a class="profile-link">C. Cuello</a></span> cambió <span class="highlight">el tipo</span> de <span class="before">Pedido de servicio</span> a <span class="after">Incidente</span>
      </div>
      <div class="activity-log__expander"></div>
      <div class="activity-item__date activity-log__date">
        <span data-timestamp="1791990689" data-timestamp-switch="14 oct. 2026, 12:11">hace un día</span>
      </div>
    </div>

    <div class="activity-item activity-log">
      <div class="activity-log__icon fa fa-sync-alt"></div>
      <div class="activity-log__content">
        <span class="author"><a class="profile-link">C. Cuello</a></span> cambió <span class="highlight">la categoría</span> de <span class="before">Mesa de Ayuda TI &gt; Solicitudes rechazadas</span> a <span class="after">Mesa de Ayuda TI &gt; Netterm &gt; Consultas</span>
      </div>
      <div class="activity-log__expander"></div>
      <div class="activity-item__date activity-log__date">
        <span data-timestamp="1791990689" data-timestamp-switch="14 oct. 2026, 12:11">hace un día</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

test("parseInvgateTimelineHtml extrae comentarios, notas internas, soluciones y logs relevantes en orden cronológico ascendente", () => {
  const entries = parseInvgateTimelineHtml(SAMPLE_INVGATE_HTML);

  assert.equal(entries.length, 4, "Debe ignorar activity-message--form y descartar cambios de estado de espera");

  // Deben quedar ordenados del más antiguo (abajo en el DOM: categoría, luego tipo) al más reciente (12:52)
  assert.equal(entries[0].timestamp, 1791990689);
  assert.equal(entries[0].kind, "log");
  assert.match(entries[0].text, /C\. Cuello cambió la categoría de Mesa de Ayuda TI > Solicitudes rechazadas a Mesa de Ayuda TI > Netterm > Consultas/);

  assert.equal(entries[1].timestamp, 1791990689);
  assert.equal(entries[1].kind, "log");
  assert.match(entries[1].text, /C\. Cuello cambió el tipo de Pedido de servicio a Incidente/);

  assert.equal(entries[2].kind, "private_note");
  assert.equal(entries[2].author, "Camila Cuello");
  assert.match(entries[2].text, /Haciendo ping a b0044w103/);

  const solEntry = entries.find((e) => e.kind === "solution");
  assert.ok(solEntry, "Debe identificar el comentario marcado como solución");
  assert.equal(solEntry.author, "Camila Cuello");
  assert.match(solEntry.text, /@L\. L\. Castillo se le indica que no hay problemas/);
  assert.doesNotMatch(solEntry.text, /evil\(\)/, "Debe eliminar tags <script> embebidos");
});

test("isRelevantTimelineLog descarta ruido operativo y preserva cambios de categoría, tipo, mesa y campos personalizados", () => {
  // Ruido descartado
  assert.equal(isRelevantTimelineLog("C. Cuello cambió el estado de espera a Esperando confirmación de solución"), false);
  assert.equal(isRelevantTimelineLog("C. Cuello cambió el estado de En espera a Solucionado"), false);
  assert.equal(isRelevantTimelineLog("Sistema cambió el estado de Abierto a En espera"), false);
  assert.equal(isRelevantTimelineLog("C. Cuello solicitó la Confirmación de Solución"), false);
  assert.equal(isRelevantTimelineLog("C. Cuello marcó Respuesta #3 como solución"), false);
  assert.equal(isRelevantTimelineLog("A. Graneros asignó a C. Cuello como agente"), false);
  assert.equal(isRelevantTimelineLog("Sistema agregó SLA Resolución por cambios en la solicitud"), false);

  // Datos críticos preservados
  assert.equal(isRelevantTimelineLog("C. Cuello cambió la categoría de Solicitudes rechazadas a Netterm- Consulta"), true);
  assert.equal(isRelevantTimelineLog("M. Dominguez cambió el tipo de Incidente a Pedido de servicio"), true);
  assert.equal(isRelevantTimelineLog("C. Cuello agregó Contacto telefónico 11111"), true);
  assert.equal(isRelevantTimelineLog("Sistema asignó a Soporte Técnico TI Nivel 1 como mesa de ayuda"), true);
});

test("isInvgateLoginPage detecta si el HTML devuelto corresponde a la pantalla de login / SAML", () => {
  assert.equal(isInvgateLoginPage('<form id="form_login"><a data-login-type="azure">Iniciar sesión</a></form>'), true);
  assert.equal(isInvgateLoginPage(SAMPLE_INVGATE_HTML), false);
});
