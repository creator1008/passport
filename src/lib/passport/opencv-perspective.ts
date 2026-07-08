import cvModule from "@techstark/opencv-js";
import sharp from "sharp";

type CvMat = import("@techstark/opencv-js").Mat;

type CvModule = typeof cvModule & {
  Mat: new (...args: unknown[]) => CvMat;
  onRuntimeInitialized?: () => void;
};

interface Point {
  x: number;
  y: number;
}

let cvPromise: Promise<CvModule> | null = null;

async function getOpenCv(): Promise<CvModule> {
  if (!cvPromise) {
    cvPromise = (async () => {
      if (cvModule instanceof Promise) {
        return (await cvModule) as CvModule;
      }
      if (cvModule.Mat) {
        return cvModule as CvModule;
      }
      await new Promise<void>((resolve) => {
        (cvModule as CvModule).onRuntimeInitialized = () => resolve();
      });
      return cvModule as CvModule;
    })();
  }
  return cvPromise;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function orderQuadPoints(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function quadAspectRatio(points: Point[]): number {
  const ordered = orderQuadPoints(points);
  const width = Math.max(
    distance(ordered[0], ordered[1]),
    distance(ordered[3], ordered[2]),
  );
  const height = Math.max(
    distance(ordered[0], ordered[3]),
    distance(ordered[1], ordered[2]),
  );
  if (!height) return 0;
  return width / height;
}

function trapezoidScore(points: Point[]): number {
  const ordered = orderQuadPoints(points);
  const topWidth = distance(ordered[0], ordered[1]);
  const bottomWidth = distance(ordered[3], ordered[2]);
  const maxWidth = Math.max(topWidth, bottomWidth, 1);
  return Math.abs(topWidth - bottomWidth) / maxWidth;
}

function extractPoints(
  approx: CvMat,
  scale: number,
): Point[] | null {
  const count = approx.rows;
  if (count < 4 || count > 6) return null;

  const points: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: (approx as CvMat & { data32S: Int32Array }).data32S[i * 2] / scale,
      y: (approx as CvMat & { data32S: Int32Array }).data32S[i * 2 + 1] / scale,
    });
  }

  if (points.length === 4) {
    return orderQuadPoints(points);
  }

  // 5~6점 근사 시 가장 큰 사각형에 가까운 4점 선택
  points.sort((a, b) => a.y - b.y);
  const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = points.slice(-2).sort((a, b) => a.x - b.x);
  return orderQuadPoints([top[0], top[1], bottom[1], bottom[0]]);
}

async function bufferToMat(cv: CvModule, buffer: Buffer): Promise<CvMat> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return cv.matFromImageData({
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  }) as CvMat;
}

async function matToBuffer(mat: CvMat): Promise<Buffer> {
  const cv = await getOpenCv();
  const rgb = new cv.Mat() as CvMat;

  if (mat.channels() === 4) {
    cv.cvtColor(mat, rgb, cv.COLOR_RGBA2RGB);
  } else {
    cv.cvtColor(mat, rgb, cv.COLOR_BGR2RGB);
  }

  const output = await sharp(Buffer.from(rgb.data), {
    raw: { width: rgb.cols, height: rgb.rows, channels: 3 },
  })
    .png()
    .toBuffer();

  rgb.delete();
  return output;
}

function findQuadFromContours(
  cv: CvModule,
  contours: InstanceType<CvModule["MatVector"]>,
  imageArea: number,
  scale: number,
): Point[] | null {
  const candidates: { area: number; areaRatio: number; points: Point[] }[] = [];

  for (let i = 0; i < contours.size(); i += 1) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    if (area < imageArea * 0.2) {
      contour.delete();
      continue;
    }

    const peri = cv.arcLength(contour, true);
    for (const epsilon of [0.02, 0.03, 0.05, 0.08]) {
      const approx = new cv.Mat() as CvMat;
      cv.approxPolyDP(contour, approx, epsilon * peri, true);
      const points = extractPoints(approx, scale);
      approx.delete();

      if (!points) continue;

      const aspect = quadAspectRatio(points);
      if (aspect < 1.05 || aspect > 1.9) continue;

      candidates.push({ area, areaRatio: area / imageArea, points });
      break;
    }

    contour.delete();
  }

  if (!candidates.length) return null;

  const preferred = candidates.filter(
    (candidate) => candidate.areaRatio >= 0.35 && candidate.areaRatio <= 0.88,
  );
  const ranked = (preferred.length ? preferred : candidates).sort((a, b) => {
    if (preferred.length) {
      return b.area - a.area;
    }
    if (Math.abs(a.areaRatio - 0.75) !== Math.abs(b.areaRatio - 0.75)) {
      return Math.abs(a.areaRatio - 0.75) - Math.abs(b.areaRatio - 0.75);
    }
    return b.area - a.area;
  });

  return ranked[0].points;
}

function findDocumentQuad(
  cv: CvModule,
  src: CvMat,
  scale: number,
): Point[] | null {
  const gray = new cv.Mat() as CvMat;
  const blurred = new cv.Mat() as CvMat;
  const edges = new cv.Mat() as CvMat;
  const thresh = new cv.Mat() as CvMat;
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat() as CvMat;
  const imageArea = src.rows * src.cols;

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

  cv.Canny(blurred, edges, 40, 120);
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE,
  );

  let quad = findQuadFromContours(cv, contours, imageArea, scale);
  contours.delete();
  hierarchy.delete();

  if (!quad) {
    const contours2 = new cv.MatVector();
    const hierarchy2 = new cv.Mat() as CvMat;
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      11,
      2,
    );
    cv.findContours(
      thresh,
      contours2,
      hierarchy2,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );
    quad = findQuadFromContours(cv, contours2, imageArea, scale);
    contours2.delete();
    hierarchy2.delete();
  }

  gray.delete();
  blurred.delete();
  edges.delete();
  thresh.delete();

  return quad;
}

export interface PerspectiveResult {
  buffer: Buffer;
  applied: boolean;
}

export async function applyPerspectiveCorrection(
  buffer: Buffer,
  maxEdge = 1600,
): Promise<PerspectiveResult> {
  try {
    const cv = await getOpenCv();
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < 200 || height < 200) {
      return { buffer, applied: false };
    }

    const longEdge = Math.max(width, height);
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;

    const detectBuffer =
      scale < 1
        ? await sharp(buffer)
            .resize({
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            })
            .toBuffer()
        : buffer;

    const detectMat = await bufferToMat(cv, detectBuffer);
    const corners = findDocumentQuad(cv, detectMat, scale);
    detectMat.delete();

    if (!corners) {
      return { buffer, applied: false };
    }

    if (trapezoidScore(corners) < 0.025) {
      return { buffer, applied: false };
    }

    const fullMat = await bufferToMat(cv, buffer);
    const ordered = orderQuadPoints(corners);

    const widthTop = distance(ordered[1], ordered[0]);
    const widthBottom = distance(ordered[2], ordered[3]);
    const maxWidth = Math.max(Math.round(Math.max(widthTop, widthBottom)), 1);

    const heightLeft = distance(ordered[3], ordered[0]);
    const heightRight = distance(ordered[2], ordered[1]);
    const maxHeight = Math.max(Math.round(Math.max(heightLeft, heightRight)), 1);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      ordered[0].x,
      ordered[0].y,
      ordered[1].x,
      ordered[1].y,
      ordered[2].x,
      ordered[2].y,
      ordered[3].x,
      ordered[3].y,
    ]) as CvMat;

    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      maxWidth - 1,
      0,
      maxWidth - 1,
      maxHeight - 1,
      0,
      maxHeight - 1,
    ]) as CvMat;

    const transform = cv.getPerspectiveTransform(srcTri, dstTri) as CvMat;
    const warped = new cv.Mat() as CvMat;
    cv.warpPerspective(
      fullMat,
      warped,
      transform,
      new cv.Size(maxWidth, maxHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );

    const output = await matToBuffer(warped);

    srcTri.delete();
    dstTri.delete();
    transform.delete();
    warped.delete();
    fullMat.delete();

    return { buffer: output, applied: true };
  } catch {
    return { buffer, applied: false };
  }
}
