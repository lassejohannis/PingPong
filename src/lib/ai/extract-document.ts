import { createAdminClient } from "@/lib/supabase/admin";

export interface DocumentContent {
  /** Extracted text (for text-based docs) */
  text: string;
  /** Base64-encoded file data (for PDFs that need vision) */
  base64?: string;
  /** Media type for the base64 data */
  mediaType?: "application/pdf";
}

/**
 * Download and extract content from a document stored in Supabase Storage.
 * For PDFs: tries text extraction first, falls back to returning raw base64 for Claude Vision.
 * For PPTX/DOCX/TXT: extracts text directly.
 */
export async function extractDocumentContent(
  fileUrl: string,
  fileType: string
): Promise<DocumentContent> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documents").download(fileUrl);

  if (error || !data) {
    throw new Error(`Failed to download document: ${error?.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  // Guard against oversized files that would cause memory issues on serverless
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum is 25MB.`);
  }

  if (fileType === "application/pdf" || fileUrl.endsWith(".pdf")) {
    // Try text extraction first
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer));
      const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;

      if (text && text.trim().length > 50) {
        return { text };
      }
    } catch {
      // Text extraction failed, fall through to base64
    }

    // Fallback: return raw PDF for Claude Vision
    return {
      text: "",
      base64: buffer.toString("base64"),
      mediaType: "application/pdf",
    };
  }

  if (
    fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    fileUrl.endsWith(".pptx")
  ) {
    const { extractXmlText } = await import("./extract-xml-zip");
    const text = await extractXmlText(buffer, /ppt\/slides\/slide\d+\.xml$/);
    return { text };
  }

  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileUrl.endsWith(".docx")
  ) {
    const { extractXmlText } = await import("./extract-xml-zip");
    const text = await extractXmlText(buffer, /word\/document\.xml$/);
    return { text };
  }

  return { text: buffer.toString("utf-8") };
}
