import "server-only";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { put, del } from "@vercel/blob";

export class UploadError extends Error {}

/**
 * File storage for product images/documents. Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is configured (§27/§49 — real integration, not
 * pretended); falls back to local disk under `public/uploads/` otherwise,
 * which keeps local development working without needing a Blob store, but
 * is NOT suitable for a serverless deploy (Vercel functions don't share or
 * persist a writable filesystem across invocations) — see docs/DEPLOY.md.
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

function usingBlobStorage(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
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

  const filename = `${crypto.randomBytes(16).toString("hex")}.${extension}`;
  const pathname = `${tenantId}/products/${productId}/${filename}`;

  if (usingBlobStorage()) {
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: false });
    return { url: blob.url };
  }

  // Path kept statically scoped under public/uploads (literal segments, not
  // built from a joined/split string) so Next's build tracer can see the
  // write never escapes that subfolder — otherwise it traces and bundles
  // the entire project as a false-positive dependency of this file write.
  const absoluteDir = path.join(process.cwd(), "public", "uploads", tenantId, "products", productId);
  await mkdir(absoluteDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(absoluteDir, filename), buffer);

  return { url: `/uploads/${tenantId}/products/${productId}/${filename}` };
}

/** Best-effort delete — a missing file (already gone, or never existed
 * because the record was created with a pasted external URL) is not an
 * error worth surfacing to the caller. */
export async function deleteProductUpload(publicUrl: string): Promise<void> {
  if (usingBlobStorage() && publicUrl.includes(".public.blob.vercel-storage.com")) {
    await del(publicUrl).catch(() => {});
    return;
  }
  if (!publicUrl.startsWith("/uploads/")) return; // external URL, nothing to delete
  const absolutePath = path.join(process.cwd(), "public", publicUrl);
  await unlink(absolutePath).catch(() => {});
}
