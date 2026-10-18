import type { APIRoute } from "astro";
import { jsonResponse } from "@lib/apiResponse";
import { withLdapClient, getLdapConfig } from "@lib/ldap";

export type ErrorCategory =
  | "config"
  | "credentials"
  | "network"
  | "timeout"
  | "base_dn"
  | "permissions"
  | "other";

interface DiagnosticResult {
  category: ErrorCategory;
  hint: string;
  detail: string;
}

function parseLdapDiagnostic(err: any): DiagnosticResult {
  const msg = String(err?.message || err || "Error desconocido");
  const code = String(err?.code || "");
  const name = String(err?.name || "");

  const config = getLdapConfig();
  if (/LDAP_USER.*LDAP_PASS|credenciales.*requerid/i.test(msg) || !config.user || !config.pass) {
    return {
      category: "config",
      hint: "Falta configurar LDAP_USER y/o LDAP_PASS en variables de entorno (.env)",
      detail: msg,
    };
  }

  if (/data 52e/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Credenciales inválidas (AD data 52e): verificar usuario y contraseña en .env",
      detail: msg,
    };
  }
  if (/data 525/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Usuario no encontrado en Active Directory (AD data 525): verificar LDAP_USER",
      detail: msg,
    };
  }
  if (/data 530|data 531/i.test(msg)) {
    return {
      category: "permissions",
      hint: "Inicio de sesión no permitido en este horario o desde esta estación (AD data 530/531)",
      detail: msg,
    };
  }
  if (/data 532/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Contraseña expirada en Active Directory (AD data 532): renovar clave de la cuenta de servicio",
      detail: msg,
    };
  }
  if (/data 533/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Cuenta deshabilitada en Active Directory (AD data 533)",
      detail: msg,
    };
  }
  if (/data 701/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Cuenta expirada en Active Directory (AD data 701)",
      detail: msg,
    };
  }
  if (/data 773/i.test(msg)) {
    return {
      category: "credentials",
      hint: "El usuario debe cambiar la contraseña antes de iniciar sesión (AD data 773)",
      detail: msg,
    };
  }
  if (/data 775/i.test(msg)) {
    return {
      category: "credentials",
      hint: "Cuenta bloqueada por reintentos en Active Directory (AD data 775)",
      detail: msg,
    };
  }

  if (/invalidCredentials|LDAP:\s*49|acceptSecurityContext/i.test(msg) || code === "49" || /InvalidCredentials/i.test(name)) {
    return {
      category: "credentials",
      hint: "Error de autenticación con el servidor LDAP: credenciales de servicio rechazadas",
      detail: msg,
    };
  }

  if (/connection timeout|timed?out|ETIMEDOUT/i.test(msg) || code === "ETIMEDOUT" || /TimeoutError/i.test(name)) {
    return {
      category: "timeout",
      hint: `Tiempo de espera agotado conectando a ${LDAP_SERVER}:${LDAP_PORT}: verificar latencia, firewall o puertos`,
      detail: msg,
    };
  }

  if (/ENOTFOUND|getaddrinfo/i.test(msg) || code === "ENOTFOUND") {
    return {
      category: "network",
      hint: `No se pudo resolver el host LDAP (${LDAP_SERVER}): verificar DNS o conectividad VPN`,
      detail: msg,
    };
  }

  if (/ECONNREFUSED/i.test(msg) || code === "ECONNREFUSED") {
    return {
      category: "network",
      hint: `Conexión rechazada en ${LDAP_SERVER}:${LDAP_PORT}: verificar que el servicio LDAP esté activo y el puerto sea correcto`,
      detail: msg,
    };
  }

  if (/ECONNRESET|ENETUNREACH|EHOSTUNREACH/i.test(msg) || /ECONNRESET|ENETUNREACH|EHOSTUNREACH/.test(code)) {
    return {
      category: "network",
      hint: `Error de enlace de red con ${LDAP_SERVER}: verificar ruteo y conectividad corporativa`,
      detail: msg,
    };
  }

  if (/no such object|LDAP:\s*32/i.test(msg) || code === "32" || /NoSuchObject/i.test(name)) {
    return {
      category: "base_dn",
      hint: `Base DN no encontrado (${LDAP_BASE_DN}): verificar la variable LDAP_BASE_DN`,
      detail: msg,
    };
  }

  if (/insufficient access|LDAP:\s*50/i.test(msg) || code === "50") {
    return {
      category: "permissions",
      hint: "Permisos insuficientes para realizar búsquedas en el Base DN configurado",
      detail: msg,
    };
  }

  return {
    category: "other",
    hint: msg,
    detail: msg,
  };
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user || locals.user.id === 0) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const start = Date.now();
  const config = getLdapConfig();

  if (!config.user || !config.pass) {
    const diag = parseLdapDiagnostic(new Error("LDAP_USER y LDAP_PASS requeridos en el entorno"));
    return jsonResponse({
      ok: false,
      category: diag.category,
      latencyMs: Date.now() - start,
      message: diag.hint,
      detail: diag.detail,
    });
  }

  try {
    await withLdapClient(async (client, cfg) => {
      await new Promise<void>((resolve, reject) => {
        client.search(
          cfg.baseDn,
          { filter: "(objectClass=*)", scope: "base", attributes: ["dn"] },
          (err, res) => {
            if (err) {
              reject(err);
              return;
            }
            res.on("error", reject);
            res.on("end", () => resolve());
          },
        );
      });
    });

    return jsonResponse({
      ok: true,
      category: null,
      latencyMs: Date.now() - start,
      message: "Conexión exitosa",
      detail: null,
    });
  } catch (error: any) {
    const diag = parseLdapDiagnostic(error);

    return jsonResponse({
      ok: false,
      category: diag.category,
      latencyMs: Date.now() - start,
      message: diag.hint,
      detail: diag.detail,
    });
  }
};
