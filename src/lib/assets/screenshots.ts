import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDatabase } from '@/lib/db/sqlite';

type SaveScreenshotParams = {
  sessionId: string;
  imageBase64: string;
  mimeType: string;
  capturedAt?: string;
  description?: string;
  source?: string;
};

type SaveScreenshotResult = {
  id: string;
  sessionId: string;
  path: string;
  capturedAt: string;
  mimeType: string;
  sizeBytes: number;
};

const SCREENSHOT_ROOT = path.join(process.cwd(), 'data', 'screenshots');

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function normalizeBase64(payload: string): string {
  const trimmed = payload.trim();
  if (trimmed.startsWith('data:')) {
    const separatorIndex = trimmed.indexOf(',');
    if (separatorIndex >= 0) {
      return trimmed.slice(separatorIndex + 1).replace(/\s/g, '');
    }
  }
  return trimmed.replace(/\s/g, '');
}

function resolveExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower in MIME_EXTENSION) {
    return MIME_EXTENSION[lower];
  }
  throw new Error(`Unsupported screenshot mime type: ${mimeType}`);
}

export async function saveScreenshotAsset(params: SaveScreenshotParams): Promise<SaveScreenshotResult> {
  const { sessionId, mimeType } = params;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('sessionId is required for screenshot storage.');
  }
  if (!params.imageBase64 || typeof params.imageBase64 !== 'string') {
    throw new Error('imageBase64 payload is required for screenshot storage.');
  }
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error('mimeType is required for screenshot storage.');
  }

  const extension = resolveExtension(mimeType);
  const base64Payload = normalizeBase64(params.imageBase64);
  const buffer = Buffer.from(base64Payload, 'base64');
  if (buffer.length === 0) {
    throw new Error('Screenshot payload decoded to zero bytes.');
  }

  const capturedDate = (() => {
    if (!params.capturedAt) {
      return new Date();
    }
    const candidate = new Date(params.capturedAt);
    if (Number.isNaN(candidate.getTime())) {
      return new Date();
    }
    return candidate;
  })();

  const capturedAtIso = capturedDate.toISOString();
  const timestampSegment = capturedAtIso.replace(/[:.]/g, '-');
  const sessionDirectory = path.join(SCREENSHOT_ROOT, sessionId);
  await fs.mkdir(sessionDirectory, { recursive: true });

  const fileId = randomUUID();
  const fileName = `${timestampSegment}_${fileId}.${extension}`;
  const filePath = path.join(sessionDirectory, fileName);
  await fs.writeFile(filePath, buffer);

  const relativePath = path
    .relative(path.join(process.cwd(), 'data'), filePath)
    .split(path.sep)
    .join('/');
  const title = params.description?.trim() || 'Screen capture frame';
  const metadata = JSON.stringify({
    capturedAt: capturedAtIso,
    description: params.description?.trim() || null,
    source: params.source?.trim() || 'screen-share',
    mimeType,
    sizeBytes: buffer.length,
  });

  const db = getDatabase();
  const assetId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO assets (id, session_id, type, title, path, created_at, metadata)
     VALUES (@id, @sessionId, @type, @title, @path, @createdAt, @metadata)`,
  ).run({
    id: assetId,
    sessionId,
    type: 'screenshot',
    title,
    path: relativePath,
    createdAt: now,
    metadata,
  });

  return {
    id: assetId,
    sessionId,
    path: relativePath,
    capturedAt: capturedAtIso,
    mimeType,
    sizeBytes: buffer.length,
  };
}
