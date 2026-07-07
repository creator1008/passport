import sharp from "sharp";
import type { QualityResult } from "@/lib/types";

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function checkImageQuality(buffer: Buffer): Promise<QualityResult> {
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
  if (aspect < 1.2 || aspect > 2.0) {
    issues.push("여권 비율과 다릅니다. 전체 여권이 보이도록 다시 촬영하세요.");
    score -= 15;
  }

  const stats = await image.greyscale().stats();
  const channel = stats.channels[0];
  if (channel) {
    if (channel.stdev < 20) {
      issues.push("이미지 대비가 낮습니다. 흐릿하거나 과노출일 수 있습니다.");
      score -= 20;
    }
    if (channel.mean < 40) {
      issues.push("이미지가 너무 어둡습니다.");
      score -= 15;
    }
    if (channel.mean > 220) {
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

export async function extractMrzRegion(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return buffer;
  }

  const cropHeight = Math.max(Math.floor(height * 0.18), 80);
  const top = Math.max(height - cropHeight, 0);

  return sharp(buffer)
    .extract({ left: 0, top, width, height: cropHeight })
    .greyscale()
    .normalize()
    .sharpen()
    .toBuffer();
}
