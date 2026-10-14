import { api } from "./api";
import type { GalleryMedia } from "./types";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadSocialFile(options: {
  file: File;
  displayName?: string;
  description?: string;
  albumId?: number;
  replaceMediaId?: number;
  duplicateAcknowledged?: boolean;
  onProgress?: (message: string) => void;
}): Promise<GalleryMedia & { duplicate_warning?: boolean; duplicate_id?: number }> {
  const {
    file,
    displayName,
    description = "",
    albumId,
    replaceMediaId,
    duplicateAcknowledged = false,
    onProgress,
  } = options;

  const checksum = await sha256Hex(file);
  onProgress?.("Starting upload…");

  const init = await api.initiateUpload({
    file_name: file.name,
    mime_type: file.type,
    file_size: file.size,
    album_id: albumId,
    replace_media_id: replaceMediaId,
  });

  for (let partNumber = 1; partNumber <= init.part_count; partNumber += 1) {
    onProgress?.(`Uploading part ${partNumber} of ${init.part_count}…`);
    const { url } = await api.uploadPartUrl({ session_id: init.session_id, part_number: partNumber });
    const start = (partNumber - 1) * init.part_size;
    const end = Math.min(start + init.part_size, file.size);
    const chunk = file.slice(start, end);
    const response = await fetch(url, { method: "PUT", body: chunk });
    if (!response.ok) throw new Error(`Upload failed on part ${partNumber}`);
    const etag = response.headers.get("ETag")?.replaceAll('"', "");
    if (!etag) {
      throw new Error(
        "Cloudflare did not expose the upload ETag. The bucket CORS policy may be missing ExposeHeaders: ETag.",
      );
    }
    await api.recordUploadPart({ session_id: init.session_id, part_number: partNumber, etag });
  }

  onProgress?.("Finalizing…");
  return api.completeUpload({
    session_id: init.session_id,
    display_name: displayName || file.name,
    description,
    checksum,
    duplicate_acknowledged: duplicateAcknowledged,
  });
}
