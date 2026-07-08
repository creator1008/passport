import { applyPerspectiveCorrection } from "@/lib/passport/opencv-perspective";
import sharp from "sharp";

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

export interface NormalizeCorrections {
  exifApplied: boolean;
  perspectiveApplied: boolean;
  mrzCropped: boolean;
  trimmed: boolean;
  majorRotation: number;
  deskewAngle: number;
}

export interface NormalizeResult {
  buffer: Buffer;
  corrections: NormalizeCorrections;
}

function horizontalProjectionVariance(
  data: Buffer,
  width: number,
  height: number,
): number {
  if (!width || !height) return 0;

  const rowSums = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      sum += data[rowOffset + x];
    }
    rowSums[y] = sum;
  }

  const mean = rowSums.reduce((acc, value) => acc + value, 0) / height;
  let variance = 0;
  for (let y = 0; y < height; y += 1) {
    variance += (rowSums[y] - mean) ** 2;
  }
  return variance / height;
}

async function estimateDeskewAngle(buffer: Buffer): Promise<number> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 100 || height < 100) {
    return 0;
  }

  const stripHeight = Math.max(Math.floor(height * 0.28), 80);
  const stripTop = Math.max(height - stripHeight, 0);

  const strip = await sharp(buffer)
    .extract({ left: 0, top: stripTop, width, height: stripHeight })
    .resize({ width: Math.min(700, width) })
    .greyscale()
    .normalize()
    .threshold(140)
    .toBuffer();

  let bestAngle = 0;
  let bestVariance = -1;

  for (let angle = -12; angle <= 12; angle += 0.5) {
    const rotated = await sharp(strip)
      .rotate(angle, { background: { r: 0, g: 0, b: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const variance = horizontalProjectionVariance(
      rotated.data,
      rotated.info.width,
      rotated.info.height,
    );

    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle = angle;
    }
  }

  return Math.abs(bestAngle) >= 0.3 ? bestAngle : 0;
}

async function correctMajorOrientation(buffer: Buffer): Promise<{
  buffer: Buffer;
  rotation: number;
}> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (height > width * 1.05) {
    return {
      buffer: await sharp(buffer).rotate(90, { background: WHITE }).toBuffer(),
      rotation: 90,
    };
  }

  if (width > height * 1.8) {
    // 과도하게 넓은 경우(파노라마) 중앙 여권 영역만 사용
    const cropWidth = Math.floor(height * 1.45);
    const left = Math.max(Math.floor((width - cropWidth) / 2), 0);
    return {
      buffer: await sharp(buffer)
        .extract({ left, top: 0, width: cropWidth, height })
        .toBuffer(),
      rotation: 0,
    };
  }

  return { buffer, rotation: 0 };
}

async function trimPassportBounds(buffer: Buffer): Promise<{
  buffer: Buffer;
  trimmed: boolean;
}> {
  try {
    const before = await sharp(buffer).metadata();
    const trimmed = await sharp(buffer)
      .trim({ threshold: 24, background: WHITE })
      .toBuffer();
    const after = await sharp(trimmed).metadata();

    const trimmedEnough = Boolean(
      before.width &&
        after.width &&
        (after.width < before.width * 0.98 ||
          (after.height ?? 0) < (before.height ?? 0) * 0.98),
    );

    return { buffer: trimmedEnough ? trimmed : buffer, trimmed: trimmedEnough };
  } catch {
    return { buffer, trimmed: false };
  }
}

async function padToPassportAspect(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return buffer;

  const aspect = width / height;
  const targetAspect = 1.42; // 여권 약 125mm x 88mm

  if (aspect >= 1.2 && aspect <= 1.65) {
    return buffer;
  }

  let targetWidth = width;
  let targetHeight = height;

  if (aspect < 1.2) {
    targetWidth = Math.floor(height * targetAspect);
  } else if (aspect > 1.65) {
    targetHeight = Math.floor(width / targetAspect);
  }

  const padLeft = Math.max(Math.floor((targetWidth - width) / 2), 0);
  const padTop = Math.max(Math.floor((targetHeight - height) / 2), 0);

  return sharp(buffer)
    .extend({
      top: padTop,
      bottom: Math.max(targetHeight - height - padTop, 0),
      left: padLeft,
      right: Math.max(targetWidth - width - padLeft, 0),
      background: WHITE,
    })
    .toBuffer();
}

export async function normalizePassportImage(buffer: Buffer): Promise<NormalizeResult> {
  const corrections: NormalizeCorrections = {
    exifApplied: true,
    perspectiveApplied: false,
    mrzCropped: false,
    trimmed: false,
    majorRotation: 0,
    deskewAngle: 0,
  };

  let current = Buffer.from(buffer);

  const perspective = await applyPerspectiveCorrection(current);
  current = Buffer.from(perspective.buffer);
  corrections.perspectiveApplied = perspective.applied;

  current = Buffer.from(await sharp(current).rotate().toBuffer());

  const trimmed = await trimPassportBounds(current);
  current = Buffer.from(trimmed.buffer);
  corrections.trimmed = trimmed.trimmed;

  const oriented = await correctMajorOrientation(current);
  current = Buffer.from(oriented.buffer);
  corrections.majorRotation = oriented.rotation;

  const deskewAngle = corrections.perspectiveApplied
    ? 0
    : await estimateDeskewAngle(current);
  if (deskewAngle !== 0) {
    current = Buffer.from(
      await sharp(current).rotate(deskewAngle, { background: WHITE }).toBuffer(),
    );
    corrections.deskewAngle = deskewAngle;
  }

  current = Buffer.from(await padToPassportAspect(current));

  return { buffer: current, corrections };
}
