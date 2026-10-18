import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const HKDF_INFO = "portal-mda-aes-256-gcm-v2";

function getMasterKey(): string {
  const metaEnv = typeof import.meta !== "undefined" && (import.meta as any).env ? (import.meta as any).env : undefined;
  const key = process.env.ENCRYPTION_KEY || metaEnv?.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "[encryption] ENCRYPTION_KEY no está configurada. " +
        "El cifrado de credenciales no funcionará sin esta variable de entorno.",
    );
  }
  return key;
}

/**
 * Deriva una clave de 32 bytes usando HKDF-SHA256 con salt dinámico por registro (formato v2).
 */
function deriveKeyV2(masterKey: string, salt: Buffer): Buffer {
  return Buffer.from(
    crypto.hkdfSync("sha256", masterKey, salt, HKDF_INFO, 32),
  );
}

/**
 * Deriva una clave legacy de 32 bytes usando SHA-256 directo (formato v1).
 */
function deriveKeyV1(masterKey: string): Buffer {
  return crypto.createHash("sha256").update(masterKey).digest();
}

/**
 * Cifra texto utilizando AES-256-GCM con HKDF-SHA256 y salt aleatorio.
 * Retorna string con formato: v2:salt_hex:iv_hex:tag_hex:cipher_hex
 */
export function encryptData(text: string): string {
  if (!text) return "";
  const masterKey = getMasterKey();

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKeyV2(masterKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `v2:${salt.toString("hex")}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Descifra un texto cifrado en formato v2 (HKDF) o v1 (legacy SHA-256) usando AES-256-GCM.
 * Modo estricto Fail-Closed: lanza error si el formato no es válido o si falla la autenticación GCM.
 */
export function decryptData(encryptedText: string): string {
  if (!encryptedText) return "";

  const masterKey = getMasterKey();

  // Formato v2: v2:salt:iv:tag:cipher
  if (encryptedText.startsWith("v2:")) {
    const parts = encryptedText.split(":");
    if (parts.length !== 5) {
      throw new Error("[encryption] Formato v2 inválido (se esperaban 5 segmentos).");
    }

    const [, saltHex, ivHex, tagHex, cipherHex] = parts;
    if (!saltHex || !ivHex || !tagHex || !cipherHex) {
      throw new Error("[encryption] Segmentos incompletos en payload v2.");
    }

    try {
      const salt = Buffer.from(saltHex, "hex");
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");
      const key = deriveKeyV2(masterKey, salt);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(
        Buffer.from(cipherHex, "hex"),
        undefined,
        "utf8",
      );
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error: any) {
      throw new Error(`[encryption] Error al descifrar payload v2: ${error.message}`);
    }
  }

  // Formato legacy v1: iv:tag:cipher
  const parts = encryptedText.split(":");
  if (parts.length === 3) {
    const [ivHex, tagHex, cipherHex] = parts;
    if (!ivHex || !tagHex || !cipherHex) {
      throw new Error("[encryption] Segmentos incompletos en payload v1.");
    }

    try {
      const key = deriveKeyV1(masterKey);
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(tagHex, "hex");

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(
        Buffer.from(cipherHex, "hex"),
        undefined,
        "utf8",
      );
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error: any) {
      throw new Error(`[encryption] Error al descifrar payload legacy v1: ${error.message}`);
    }
  }

  throw new Error("[encryption] Formato de texto cifrado no reconocido.");
}

// Alias para compatibilidad con código existente
export const encrypt = encryptData;
export const decrypt = decryptData;
