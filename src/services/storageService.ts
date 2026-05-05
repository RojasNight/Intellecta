import { getSupabaseClient } from "../lib/supabase";

const BOOK_COVERS_BUCKET = "book-covers";
const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type AllowedCoverMimeType = (typeof ALLOWED_COVER_MIME_TYPES)[number];

function isAllowedMimeType(type: string): type is AllowedCoverMimeType {
  return ALLOWED_COVER_MIME_TYPES.includes(type as AllowedCoverMimeType);
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  const raw = file.name.split(".").pop()?.toLowerCase();
  return raw && ["jpg", "jpeg", "png", "webp"].includes(raw) ? raw : "jpg";
}

function getStorageErrorMessage(message?: string) {
  const text = message?.toLowerCase() ?? "";

  if (text.includes("row-level security") || text.includes("permission") || text.includes("not authorized")) {
    return "Недостаточно прав для загрузки обложки.";
  }

  if (text.includes("payload") || text.includes("size") || text.includes("file size")) {
    return "Размер файла не должен превышать 5 МБ.";
  }

  if (text.includes("mime") || text.includes("content type")) {
    return "Поддерживаются только JPG, PNG или WebP.";
  }

  return "Не удалось загрузить обложку.";
}

export function validateBookCoverFile(file: File | null | undefined) {
  if (!file) {
    throw new Error("Выберите изображение обложки.");
  }

  if (!isAllowedMimeType(file.type)) {
    throw new Error("Поддерживаются только JPG, PNG или WebP.");
  }

  if (file.size > MAX_COVER_SIZE_BYTES) {
    throw new Error("Размер файла не должен превышать 5 МБ.");
  }
}

export async function uploadBookCover(file: File, bookId: string): Promise<string> {
  validateBookCoverFile(file);

  if (!bookId) {
    throw new Error("Сначала сохраните книгу, затем загрузите обложку.");
  }

  const supabase = getSupabaseClient();
  const extension = getFileExtension(file);
  const safeBookId = bookId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const path = `${safeBookId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(BOOK_COVERS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    console.error("[Интеллекта][storage] Ошибка загрузки обложки", {
      message: error.message,
      bucket: BOOK_COVERS_BUCKET,
      path,
    });
    throw new Error(getStorageErrorMessage(error.message));
  }

  return getPublicCoverUrl(path);
}

export async function deleteBookCoverByPath(path: string): Promise<void> {
  if (!path) return;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(BOOK_COVERS_BUCKET).remove([path]);

  if (error) {
    console.warn("[Интеллекта][storage] Не удалось удалить старую обложку", {
      message: error.message,
      bucket: BOOK_COVERS_BUCKET,
      path,
    });
  }
}

export function getPublicCoverUrl(path: string): string {
  const supabase = getSupabaseClient();
  const { data } = supabase.storage.from(BOOK_COVERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function extractStoragePathFromPublicUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BOOK_COVERS_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index === -1) return null;

    const rawPath = parsed.pathname.slice(index + marker.length);
    return rawPath ? decodeURIComponent(rawPath) : null;
  } catch {
    return null;
  }
}

export const BOOK_COVER_UPLOAD_RULES = {
  bucket: BOOK_COVERS_BUCKET,
  maxSizeBytes: MAX_COVER_SIZE_BYTES,
  allowedMimeTypes: [...ALLOWED_COVER_MIME_TYPES],
};
