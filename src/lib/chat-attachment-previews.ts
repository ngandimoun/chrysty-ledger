export function getFilePreviewKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function revokeFilePreviewUrls(previews: Record<string, string>): void {
  for (const url of Object.values(previews)) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
}

/** Reject images the browser (and vision API) cannot decode. */
export async function canDecodeImageFile(file: File): Promise<boolean> {
  if (!file.type.startsWith("image/")) return true;

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return true;
    }

    return await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      img.src = url;
    });
  } catch {
    return false;
  }
}
