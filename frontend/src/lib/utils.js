export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function downloadImage(imageUrl, filename = "image") {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    
    // Get the blob
    const blob = await response.blob();
    
    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary anchor element and trigger download
    const link = document.createElement("a");
    link.href = url;
    
    // Extract file extension from URL or use jpg as default
    const urlParts = imageUrl.split(".");
    const extension = urlParts[urlParts.length - 1].split("?")[0] || "jpg";
    link.download = `${filename}.${extension}`;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the temporary URL
    window.URL.revokeObjectURL(url);
  } catch (error) {
    try {
      const { logger } = await import("./logger");
      logger.error("Error downloading image:", error);
    } catch (_) {}
    throw error;
  }
}

// Download any file with progress callback (0–100)
export async function downloadFileWithProgress(fileUrl, filename = "file", onProgress) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error("Failed to fetch file");

  const contentTypeHeader = (res.headers.get("content-type") || "").split(";")[0].trim();
  const contentLength = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength && typeof onProgress === "function") {
      onProgress(Math.min(100, Math.round((received / contentLength) * 100)));
    }
  }

  const typeToExt = (ct) => {
    const map = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "text/plain": "txt",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/zip": "zip",
      "application/octet-stream": "bin",
    };
    return map[ct] || null;
  };

  const blob = new Blob(chunks, { type: contentTypeHeader || undefined });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  // Determine final filename: if a name with extension is provided, use it as-is.
  let finalName = filename || "file";
  const hasExtension = /\.[A-Za-z0-9]+$/.test(finalName);

  if (!hasExtension) {
    // Prefer extension from Content-Type; fallback to URL; default to bin
    const extFromType = typeToExt(contentTypeHeader);
    const urlParts = fileUrl.split(".");
    const urlExt = urlParts.length > 1 ? urlParts[urlParts.length - 1].split("?")[0] : null;
    const ext = extFromType || urlExt || "bin";
    finalName = `${finalName}.${ext}`;
  }

  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  if (typeof onProgress === "function") onProgress(100);
}

// Returns "Today", "Yesterday", or a formatted date for older messages
export function formatDayLabel(date) {
  const d = new Date(date);
  const now = new Date();

  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
