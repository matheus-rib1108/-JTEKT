import "server-only";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

export class UploadError extends Error {}

/**
 * Local-disk file storage under `public/uploads/`. No object-storage
 * integration is configured for this installation — flagged here rather
 * than pretended away (§49 "não inventar integração"). Fine for a
 * single-instance/local deployment; a production multi-instance rollout
 * needs this swapped for S3/Blob (tracked in docs/ROADMAP.md), since
 * files written to disk here don't survive a redeploy or get shared
 * across instances.
 */

export type UploadKind = "image" | "document";

const MIME_EXTENSIONS: Record<UploadKind, Record<string, string>> = {
  image: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
  document: { "application/pdf": "pdf" },
};

const MAX_BYTES: Record<UploadKind, number> = {
  image: 5 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

export interface SavedUpload {
  url: string;
}

/**
 * Validates and persists an uploaded file. The stored filename is always a
 * fresh random token + an extension derived from the *validated MIME
 * type* — never from the caller-supplied filename, which is untrusted
 * input (§27 "validação de uploads").
 */
export async function saveProductUpload(
  file: File,
  kind: UploadKind,
  tenantId: string,
  productId: string,
): Promise<SavedUpload> {
  const extensionByMime = MIME_EXTENSIONS[kind];
  const extension = extensionByMime[file.type];
  if (!extension) {
    throw new UploadError(
      kind === "image"
        ? "Formato de imagem não suportado. Use JPG, PNG ou WEBP."
        : "Formato de documento não suportado. Use PDF.",
    );
  }

  if (file.size === 0) {
    throw new UploadError("Arquivo vazio.");
  }
  const maxBytes = MAX_BYTES[kind];
  if (file.size > maxBytes) {
    throw new UploadError(`Arquivo maior que o limite permitido (${Math.round(maxBytes / 1024 / 1024)}MB).`);
  }

  // Path kept statically scoped under public/uploads (literal segments, not
  // built from a joined/split string) so Next's build tracer can see the
  // write never escapes that subfolder — otherwise it traces and bundles
  // the entire project as a false-positive dependency of this file write.
  const absoluteDir = path.join(process.cwd(), "public", "uploads", tenantId, "products", productId);
  await mkdir(absoluteDir, { recursive: true });

  const filename = `${crypto.randomBytes(16).toString("hex")}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(absoluteDir, filename), buffer);

  return { url: `/uploads/${tenantId}/products/${productId}/${filename}` };
}

/** Best-effort delete — a missing file (already gone, or never existed
 * because the record was created with a pasted external URL) is not an
 * error worth surfacing to the caller. */
export async function deleteLocalUpload(publicUrl: string): Promise<void> {
  if (!publicUrl.startsWith("/uploads/")) return; // external URL, nothing to delete
  const absolutePath = path.join(process.cwd(), "public", publicUrl);
  await unlink(absolutePath).catch(() => {});
}
