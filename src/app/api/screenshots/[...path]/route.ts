import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SCREENSHOT_ROOT = path.join(process.cwd(), 'data', 'screenshots');

const EXTENSION_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function resolveScreenshotPath(segments: string[]): string {
  const safeSegments = segments.filter((segment) => segment && segment !== '.');
  const joinedPath = path.join(SCREENSHOT_ROOT, ...safeSegments);
  const resolvedPath = path.resolve(joinedPath);
  if (!resolvedPath.startsWith(SCREENSHOT_ROOT)) {
    throw new Error('Invalid screenshot path.');
  }
  return resolvedPath;
}

function getMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return EXTENSION_MIME[extension] ?? 'application/octet-stream';
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  const { path: segments } = context.params;

  if (!segments || segments.length === 0) {
    return NextResponse.json({ success: false, message: 'Screenshot path is required.' }, { status: 400 });
  }

  try {
    const filePath = resolveScreenshotPath(segments);
    const fileStats = await fs.stat(filePath);
    if (!fileStats.isFile()) {
      return NextResponse.json({ success: false, message: 'Screenshot not found.' }, { status: 404 });
    }

    const data = await fs.readFile(filePath);
    const mimeType = getMimeType(filePath);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('Invalid screenshot path') ? 400 : 404;
    return NextResponse.json({ success: false, message: 'Screenshot could not be retrieved.' }, { status });
  }
}

export const dynamic = 'force-dynamic';
