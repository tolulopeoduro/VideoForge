import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(process.cwd(), "public", "generated", ...params.path);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();

    let contentType = "application/octet-stream";
    if (ext === ".wav") contentType = "audio/wav";
    else if (ext === ".mp3") contentType = "audio/mpeg";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".mp4") contentType = "video/mp4";

    // Support HTTP Range requests for video/audio scrubbers & Remotion Player
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });

      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Failed to serve media", { status: 500 });
  }
}
