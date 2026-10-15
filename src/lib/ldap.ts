import ldap from "ldapjs";

export interface LdapConfig {
  server: string;
  port: number;
  baseDn: string;
  user: string;
  pass: string;
  timeoutMs: number;
}

export function getLdapConfig(): LdapConfig {
  return {
    server: process.env.LDAP_SERVER || "ldap://correo.local",
    port: Number(process.env.LDAP_PORT) || 389,
    baseDn: process.env.LDAP_BASE_DN || "DC=correo,DC=local",
    user: process.env.LDAP_USER || "",
    pass: process.env.LDAP_PASS || "",
    timeoutMs: Number(process.env.LDAP_TIMEOUT_MS) || 5000,
  };
}

export interface ClassifiedLdapError {
  isConfigMissing: boolean;
  isNetworkFailure: boolean;
  isAuthFailure: boolean;
  originalMessage: string;
}

export function classifyLdapError(error: unknown): ClassifiedLdapError {
  const msg = error instanceof Error ? error.message : String(error || "");
  const code = (error as { code?: unknown })?.code;
  const name = (error as { name?: unknown })?.name;
  const codeStr = typeof code === "string" || typeof code === "number" ? String(code) : "";
  const nameStr = typeof name === "string" ? name : "";

  const isConfigMissing = /LDAP_USER.*LDAP_PASS|credenciales.*requerid/i.test(msg);

  const isNetworkFailure =
    /connection timeout|timed?out|enotfound|econnrefused|econnreset|enetunreach|ehostunreach|no disponible|connect/i.test(
      msg,
    ) ||
    /ConnectionError|TimeoutError/i.test(nameStr) ||
    /ETIMEDOUT|ENOTFOUND|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH/.test(codeStr);

  const isAuthFailure =
    !isNetworkFailure &&
    (/autenticación|invalid credentials|bind error|data 52e|data 775|acceptSecurityContext/i.test(
      msg,
    ) ||
      code === 49 ||
      codeStr === "49" ||
      /InvalidCredentials/i.test(nameStr));

  return {
    isConfigMissing,
    isNetworkFailure,
    isAuthFailure,
    originalMessage: msg,
  };
}

export function getLdapUserErrorMessage(error: unknown): string {
  const classification = classifyLdapError(error);

  if (classification.isConfigMissing) {
    return "Credenciales de Active Directory no configuradas en el servidor.";
  }
  if (classification.isNetworkFailure) {
    return "No se pudo conectar con el servidor de Active Directory (tiempo de espera agotado). Verifique la conectividad de red o VPN.";
  }
  if (classification.isAuthFailure) {
    return "Error de autenticación con el servidor de Active Directory. Las credenciales de servicio fueron rechazadas.";
  }
  return "Error al consultar Active Directory.";
}

export async function withLdapClient<T>(
  fn: (client: ldap.Client, config: LdapConfig) => Promise<T>,
): Promise<T> {
  const config = getLdapConfig();

  if (!config.user || !config.pass) {
    throw new Error("LDAP_USER y LDAP_PASS requeridos en el entorno");
  }

  const client = ldap.createClient({
    url: `${config.server}:${config.port}`,
    reconnect: false,
    connectTimeout: config.timeoutMs,
    timeout: config.timeoutMs * 2,
  });

  client.on("error", (err) => {
    console.error("[LDAP] Client Socket Error:", err?.message || err);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      client.bind(config.user, config.pass, (err) => {
        if (err) {
          reject(
            new Error(
              `Error de autenticación LDAP: ${err.message || err.code || JSON.stringify(err)}`,
            ),
          );
        } else {
          resolve();
        }
      });
    });

    return await fn(client, config);
  } finally {
    try {
      client.unbind();
    } catch {
      // noop
    }
  }
}
