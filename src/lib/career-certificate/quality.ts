import sharp from "sharp";
import type { QualityResult } from "@/lib/types";

const MIN_WIDTH = 600;
const MIN_HEIGHT = 800;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function checkCareerCertificateQuality(
  buffer: Buffer,
  mimeType?: string,
): Promise<QualityResult> {
  if (mimeType && mimeType.includes("pdf")) {
    return {
      score: 85,
      issues: [],
      width: 0,
      height: 0,
    };
  }

  const issues: string[] = [];
  let score = 100;

  if (buffer.length > MAX_FILE_SIZE) {
    issues.push("파일 크기가 10MB를 초과합니다.");
    score -= 30;
  }

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    issues.push(`해상도가 낮습니다 (${width}x${height}). 최소 ${MIN_WIDTH}x${MIN_HEIGHT} 권장.`);
    score -= 25;
  }

  const aspect = width / Math.max(height, 1);
  if (aspect < 0.5 || aspect > 1.5) {
    issues.push("문서 비율이 비정상적입니다. 전체 문서가 보이도록 다시 촬영하세요.");
    score -= 10;
  }

  const stats = await image.greyscale().stats();
  const channel = stats.channels[0];
  if (channel) {
    if (channel.stdev < 18) {
      issues.push("이미지 대비가 낮습니다. 흐릿하거나 과노출일 수 있습니다.");
      score -= 20;
    }
    if (channel.mean < 40) {
      issues.push("이미지가 너무 어둡습니다.");
      score -= 15;
    }
    if (channel.mean > 225) {
      issues.push("이미지가 너무 밝습니다.");
      score -= 15;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    width,
    height,
  };
}

export async function preprocessForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 2400, withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen()
    .toBuffer();
}
