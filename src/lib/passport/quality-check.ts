import sharp, { type Sharp } from "sharp";
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
  if (aspect < 1.05 || aspect > 2.2) {
    issues.push("여권 비율과 다릅니다. 전체 여권이 보이도록 다시 촬영하세요.");
    score -= 10;
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

export interface MrzBand {
  top: number;
  height: number;
}

function smoothRowDensity(values: number[], radius: number): number[] {
  const smoothed = new Array<number>(values.length).fill(0);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j += 1) {
      sum += values[j];
      count += 1;
    }
    smoothed[i] = sum / count;
  }
  return smoothed;
}

export async function locateMrzBand(buffer: Buffer): Promise<MrzBand | null> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 100 || height < 100) {
    return null;
  }

  const scanTop = Math.floor(height * 0.45);
  const scanHeight = height - scanTop;
  const scaledWidth = 640;
  const scaledHeight = Math.max(Math.round(scanHeight * (scaledWidth / width)), 80);

  const { data } = await sharp(buffer)
    .extract({ left: 0, top: scanTop, width, height: scanHeight })
    .resize({ width: scaledWidth, height: scaledHeight })
    .greyscale()
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowDensity: number[] = [];
  for (let y = 0; y < scaledHeight; y += 1) {
    let dark = 0;
    const rowOffset = y * scaledWidth;
    for (let x = 0; x < scaledWidth; x += 1) {
      if (data[rowOffset + x] < 145) {
        dark += 1;
      }
    }
    rowDensity.push(dark / scaledWidth);
  }

  const smoothed = smoothRowDensity(rowDensity, 2);
  const windowSize = Math.max(Math.floor(scaledHeight * 0.18), 22);

  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start <= scaledHeight - windowSize; start += 1) {
    let score = 0;
    for (let y = start; y < start + windowSize; y += 1) {
      score += smoothed[y];
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  if (bestScore < windowSize * 0.08) {
    return null;
  }

  const bandTop =
    scanTop +
    Math.floor((bestStart / scaledHeight) * scanHeight) -
    Math.floor(height * 0.08);
  const bandHeight =
    Math.ceil((windowSize / scaledHeight) * scanHeight) + Math.floor(height * 0.14);

  return {
    top: Math.max(0, bandTop),
    height: Math.min(Math.max(bandHeight, 120), height - Math.max(0, bandTop)),
  };
}

async function buildMrzRegion(
  buffer: Buffer,
  preprocess: (pipeline: Sharp) => Sharp,
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return buffer;
  }

  const band = await locateMrzBand(buffer);
  const cropTop = band
    ? Math.max(band.top - Math.floor(height * 0.08), Math.floor(height * 0.58))
    : Math.floor(height * 0.58);
  const cropHeight = Math.max(height - cropTop, Math.floor(height * 0.28));
  const targetWidth = Math.min(Math.max(width, 1400), 2800);

  const pipeline = sharp(buffer).extract({
    left: 0,
    top: cropTop,
    width,
    height: Math.min(cropHeight, height - cropTop),
  });

  return preprocess(pipeline.resize({ width: targetWidth, withoutEnlargement: false }))
    .png()
    .toBuffer();
}

export async function extractMrzRegion(buffer: Buffer): Promise<Buffer> {
  return buildMrzRegion(buffer, (pipeline) =>
    pipeline.greyscale().normalize().sharpen(),
  );
}

export async function extractMrzRegionAlt(buffer: Buffer): Promise<Buffer> {
  return buildMrzRegion(buffer, (pipeline) =>
    pipeline.greyscale().normalize().sharpen().threshold(150),
  );
}

export async function extractMrzRegionWide(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!width || !height) {
    return buffer;
  }

  const band = await locateMrzBand(buffer);
  const cropTop = band
    ? Math.max(band.top - Math.floor(height * 0.06), Math.floor(height * 0.58))
    : Math.floor(height * 0.58);
  const cropHeight = height - cropTop;
  const targetWidth = Math.min(Math.max(width, 1400), 2800);

  return sharp(buffer)
    .extract({ left: 0, top: cropTop, width, height: cropHeight })
    .resize({ width: targetWidth, withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}
