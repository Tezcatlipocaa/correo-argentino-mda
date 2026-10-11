import fs from "node:fs";
import path from "node:path";
import { ensureDir, getStorageRoot } from "@lib/storage";

export const KB_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export class KbImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KbImageValidationError";
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_EXTENSIONS));
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_MAGIC = Buffer.from("RIFF", "ascii");
const WEBP_MAGIC = Buffer.from("WEBP", "ascii");

function getKbImagesDir(helpdeskId: number): string {
  return path.join(getStorageRoot(), "kb-images", String(helpdeskId));
}

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return (
    buffer.length >= signature.length &&
    buffer.subarray(0, signature.length).equals(signature)
  );
}

function sniffImageMime(buffer: Buffer): string | null {
  if (startsWith(buffer, PNG_MAGIC)) {
    return "image/png";
  }
  if (startsWith(buffer, JPEG_MAGIC)) {
    return "image/jpeg";
  }
  if (
    startsWith(buffer, RIFF_MAGIC) &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).equals(WEBP_MAGIC)
  ) {
    return "image/webp";
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processKbImageUpload(
  file: File,
  helpdeskId: number,
): Promise<{ url: string }> {
  if (!Number.isInteger(helpdeskId) || helpdeskId <= 0) {
    throw new KbImageValidationError(
      "El identificador de la mesa de ayuda no es válido.",
    );
  }

  if (file.size === 0) {
    throw new KbImageValidationError(
      "La imagen está vacía. El máximo permitido es 2 MB.",
    );
  }

  if (file.size > KB_IMAGE_MAX_BYTES) {
    throw new KbImageValidationError("La imagen supera el límite de 2 MB.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new KbImageValidationError(
      `El tipo de archivo "${file.type || "desconocido"}" no está permitido. Usá imágenes PNG, JPG o WebP.`,
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    console.error(
      `[kbImageUpload] Error al leer la imagen: ${errorMessage(error)}`,
    );
    throw new Error("No se pudo leer la imagen enviada.");
  }

  if (buffer.length === 0) {
    throw new KbImageValidationError(
      "La imagen está vacía. El máximo permitido es 2 MB.",
    );
  }

  if (buffer.length > KB_IMAGE_MAX_BYTES) {
    throw new KbImageValidationError("La imagen supera el límite de 2 MB.");
  }

  const sniffedMime = sniffImageMime(buffer);
  if (!sniffedMime || sniffedMime !== file.type) {
    throw new KbImageValidationError(
      "El contenido del archivo no coincide con su tipo MIME. Usá una imagen PNG, JPG o WebP válida.",
    );
  }

  const filename = `${crypto.randomUUID()}.${MIME_EXTENSIONS[sniffedMime]}`;
  const destinationDir = getKbImagesDir(helpdeskId);
  const destination = path.join(destinationDir, filename);

  try {
    ensureDir(destinationDir);
    fs.writeFileSync(destination, buffer);
  } catch (error) {
    console.error(
      `[kbImageUpload] Error al escribir "${filename}": ${errorMessage(error)}`,
    );
    throw new Error(
      "No se pudo guardar la imagen en el servidor. Verificá los permisos de la carpeta de almacenamiento.",
    );
  }

  return { url: `/api/kb/images/${helpdeskId}/${filename}` };
}
