import "dotenv/config";
import dns from "node:dns/promises";
import net from "node:net";
import ldap from "ldapjs";
import { getLdapConfig, classifyLdapError } from "../src/lib/ldap";

async function runLdapDiagnostics(): Promise<void> {
  const config = getLdapConfig();
  console.log("=== Diagnóstico de Active Directory / LDAP ===");
  console.log(`Servidor: ${config.server}`);
  console.log(`Puerto: ${config.port}`);
  console.log(`Base DN: ${config.baseDn}`);
  console.log(`Usuario: ${config.user || "(no configurado)"}`);
  console.log(`Password: ${config.pass ? "*".repeat(Math.min(config.pass.length, 8)) : "(no configurado)"}`);
  console.log(`Timeout: ${config.timeoutMs} ms`);
  console.log("-----------------------------------------------");

  if (!config.user || !config.pass) {
    console.error("ERROR: LDAP_USER y LDAP_PASS deben estar configurados en .env");
    process.exit(1);
  }

  const parsedUrl = new URL(config.server.startsWith("ldap") ? config.server : `ldap://${config.server}`);
  const hostname = parsedUrl.hostname;

  console.log(`1. Comprobando resolución DNS para '${hostname}'...`);
  try {
    const addresses = await dns.resolve4(hostname);
    console.log(`   DNS OK: ${addresses.join(", ")}`);
  } catch (dnsErr: any) {
    console.error(`   DNS FALLÓ: ${dnsErr.message}`);
    process.exit(1);
  }

  console.log(`2. Comprobando conectividad TCP hacia ${hostname}:${config.port}...`);
  const tcpOk = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: hostname, port: config.port, timeout: config.timeoutMs });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });

  if (!tcpOk) {
    console.error(`   TCP FALLÓ: No se pudo conectar al puerto ${config.port} de '${hostname}'.`);
    console.error("   Causa: El puerto está bloqueado por firewall, se requiere conexión VPN o el servidor está caído.");
    process.exit(1);
  }
  console.log(`   TCP OK: Puerto ${config.port} accesible.`);

  console.log("3. Comprobando autenticación LDAP (bind)...");
  const client = ldap.createClient({
    url: `${config.server}:${config.port}`,
    reconnect: false,
    connectTimeout: config.timeoutMs,
    timeout: config.timeoutMs,
  });

  client.on("error", (err) => {
    // Evita throw no controlado por EventEmitter
  });

  const bindResult = await new Promise<{ ok: boolean; error?: unknown }>((resolve) => {
    client.bind(config.user, config.pass, (err) => {
      if (err) {
        resolve({ ok: false, error: err });
      } else {
        resolve({ ok: true });
      }
    });
  });

  try {
    client.unbind();
  } catch {
    // noop
  }

  if (!bindResult.ok) {
    const classification = classifyLdapError(bindResult.error);
    console.error("   BIND FALLÓ: Las credenciales fueron rechazadas por el dominio o hubo un error LDAP.");
    console.error(`   Detalle: ${classification.originalMessage}`);
    if (classification.isAuthFailure) {
      console.error("   Causa: Usuario o contraseña incorrectos en el .env.");
    }
    process.exit(1);
  }

  console.log("   BIND OK: Autenticación exitosa contra Active Directory.");
  console.log("===============================================");
  console.log("Diagnóstico finalizado con éxito.");
}

runLdapDiagnostics().catch((err) => {
  console.error("Error inesperado en diagnóstico:", err);
  process.exit(1);
});
