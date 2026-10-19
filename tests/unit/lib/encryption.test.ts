import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { encryptData, decryptData, encrypt, decrypt } from "@lib/encryption";

describe("encryption module hardening (v2 HKDF + Fail-Closed)", () => {
  const originalEnvKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Clave de prueba de 32 caracteres
    process.env.ENCRYPTION_KEY = "test-secret-key-32-chars-long!!";
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnvKey;
  });

  it("cifra texto con prefijo v2 y formato de 5 segmentos hexadecimales", () => {
    const plain = "password-super-secreta-123";
    const encrypted = encryptData(plain);

    expect(encrypted.startsWith("v2:")).toBe(true);
    const parts = encrypted.split(":");
    expect(parts.length).toBe(5);
    const [prefix, saltHex, ivHex, tagHex, cipherHex] = parts;

    expect(prefix).toBe("v2");
    expect(saltHex.length).toBe(32); // 16 bytes salt
    expect(ivHex.length).toBe(24);   // 12 bytes IV
    expect(tagHex.length).toBe(32);  // 16 bytes GCM auth tag
    expect(cipherHex.length).toBeGreaterThan(0);

    // Debe descifrar correctamente
    const decrypted = decryptData(encrypted);
    expect(decrypted).toBe(plain);
  });

  it("genera salts e IVs aleatorios produciendo ciphertexts distintos para el mismo texto", () => {
    const plain = "mismo-texto-plano";
    const enc1 = encryptData(plain);
    const enc2 = encryptData(plain);

    expect(enc1).not.toBe(enc2);
    expect(decryptData(enc1)).toBe(plain);
    expect(decryptData(enc2)).toBe(plain);
  });

  it("mantiene retrocompatibilidad de lectura con formato legacy v1 (3 partes: iv:tag:cipher)", () => {
    // Generar un payload legacy v1 con SHA-256 directo
    const masterKey = process.env.ENCRYPTION_KEY!;
    const key = crypto.createHash("sha256").update(masterKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plain = "clave-guardada-en-v1";
    let encryptedHex = cipher.update(plain, "utf8", "hex");
    encryptedHex += cipher.final("hex");
    const tagHex = cipher.getAuthTag().toString("hex");

    const legacyPayload = `${iv.toString("hex")}:${tagHex}:${encryptedHex}`;

    // decryptData debe poder descifrar el payload v1
    const decrypted = decryptData(legacyPayload);
    expect(decrypted).toBe(plain);
  });

  it("opera en modo fail-closed estricto lanzando error ante authTag corrupto o inválido", () => {
    const encrypted = encryptData("secreto");
    const parts = encrypted.split(":");
    // Corromper el authTag (parts[3])
    parts[3] = "00000000000000000000000000000000";
    const corrupted = parts.join(":");

    expect(() => decryptData(corrupted)).toThrow();
  });

  it("opera en modo fail-closed estricto lanzando error ante formato malformado", () => {
    expect(() => decryptData("v2:incompleto")).toThrow();
    expect(() => decryptData("payload:no:hex:valido:123")).toThrow();
  });

  it("devuelve string vacío si se pasa string vacío o nulo", () => {
    expect(encryptData("")).toBe("");
    expect(decryptData("")).toBe("");
  });

  it("respeta los alias encrypt y decrypt", () => {
    const plain = "alias-test";
    const enc = encrypt(plain);
    expect(decrypt(enc)).toBe(plain);
  });
});
