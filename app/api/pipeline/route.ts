import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Verify scenes payload exists
    if (!payload.scenes || !Array.isArray(payload.scenes)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: 'scenes' array is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const scriptPath = path.resolve(process.cwd(), "scripts", "pipeline.py");

    // Spawn Python child process
    const pythonProc = spawn("python3", [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Feed JSON payload into python process stdin
        pythonProc.stdin.write(JSON.stringify(payload));
        pythonProc.stdin.end();

        // Listen for stdout NDJSON lines
        let buffer = "";
        pythonProc.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(encoder.encode(line.trim() + "\n"));
            }
          }
        });

        pythonProc.stderr.on("data", (errData: Buffer) => {
          console.error("[Python Pipeline Error]", errData.toString("utf-8"));
        });

        pythonProc.on("close", (code) => {
          if (buffer.trim()) {
            controller.enqueue(encoder.encode(buffer.trim() + "\n"));
          }
          if (code !== 0) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "error",
                  error: `Pipeline process exited with code ${code}`,
                }) + "\n"
              )
            );
          }
          controller.close();
        });

        pythonProc.on("error", (err) => {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: `Failed to spawn Python process: ${err.message}`,
              }) + "\n"
            )
          );
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to trigger pipeline" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
