import { PDFParse } from "pdf-parse";

const MIN_TEXT_LENGTH = 80;

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.slice(0, 5).toString("utf8") === "%PDF-";
}

export async function renderPdfFirstPageToPng(buffer: Buffer): Promise<Buffer> {
  const parser = new PDFParse({ data: buffer });
  try {
    const screenshot = await parser.getScreenshot({
      first: 1,
      scale: 2,
      imageBuffer: true,
    });
    const page = screenshot.pages[0];
    if (!page?.data) {
      throw new Error("Failed to render PDF page");
    }
    return Buffer.from(page.data);
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfContent(buffer: Buffer): Promise<{
  text: string;
  ocrImage: Buffer | null;
}> {
  if (!isPdfBuffer(buffer)) {
    throw new Error("Invalid PDF file");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const text = (textResult.text ?? "").trim();

    if (text.length >= MIN_TEXT_LENGTH) {
      return { text, ocrImage: null };
    }

    const screenshot = await parser.getScreenshot({
      first: 1,
      scale: 2,
      imageBuffer: true,
    });
    const page = screenshot.pages[0];
    const ocrImage = page?.data ? Buffer.from(page.data) : null;
    return { text, ocrImage };
  } finally {
    await parser.destroy();
  }
}

export async function getPdfPreviewImage(buffer: Buffer): Promise<Buffer> {
  return renderPdfFirstPageToPng(buffer);
}

export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.includes("pdf");
}
