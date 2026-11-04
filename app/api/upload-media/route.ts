import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in upload request" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename
    const originalName = file.name || "media";
    const ext = path.extname(originalName).toLowerCase() || ".png";
    const safeBase = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 32);

    const filename = `upload_${Date.now()}_${safeBase}${ext}`;
    const generatedDir = path.join(process.cwd(), "public", "generated");
    fs.mkdirSync(generatedDir, { recursive: true });

    const fullPath = path.join(generatedDir, filename);
    fs.writeFileSync(fullPath, buffer);

    const isVideo = [".mp4", ".webm", ".mov"].includes(ext) || file.type.startsWith("video/");

    return NextResponse.json({
      success: true,
      url: `/generated/${filename}`,
      filename,
      mediaType: isVideo ? "video" : "image",
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error("Upload media error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save uploaded media" },
      { status: 500 }
    );
  }
}
