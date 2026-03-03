/**
 * GET /api/docs/export?stream=tech&slug=backend/rbac&format=html|pdf|latex
 *
 * Fetches an MDX doc from Vercel Blob and streams it back as the requested
 * document format. Requires at least reader access for the calling user.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readRawDoc } from "@/lib/docs/write";
import {
  exportAsHtml,
  exportAsPdf,
  exportAsLatex,
  ExportFormat,
} from "@/lib/docs/export";

const VALID_FORMATS: ExportFormat[] = ["html", "pdf", "latex"];

const MIME_MAP: Record<ExportFormat, string> = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  latex: "application/x-latex",
};

const EXT_MAP: Record<ExportFormat, string> = {
  html: "html",
  pdf: "pdf",
  latex: "tex",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stream = searchParams.get("stream") ?? "";
  const slugStr = searchParams.get("slug") ?? "";
  const format = (searchParams.get("format") ?? "html") as ExportFormat;

  if (!stream || !slugStr)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  if (!VALID_FORMATS.includes(format))
    return NextResponse.json(
      { error: `Invalid format. Choose one of: ${VALID_FORMATS.join(", ")}` },
      { status: 400 },
    );

  // Access check — admin can export any stream, others need team membership
  if (session.role !== "admin" && !session.teams.includes(stream))
    return NextResponse.json(
      { error: "No access to this stream" },
      { status: 403 },
    );

  const slug = slugStr.split("/").filter(Boolean);
  const docResult = await readRawDoc(stream, slug);
  if (!docResult)
    return NextResponse.json({ error: "Doc not found" }, { status: 404 });

  try {
    let buffer: Buffer;
    if (format === "html") buffer = await exportAsHtml(docResult.raw);
    else if (format === "pdf") buffer = await exportAsPdf(docResult.raw);
    else buffer = await exportAsLatex(docResult.raw);

    const filename = `${slug.at(-1) ?? "doc"}.${EXT_MAP[format]}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": MIME_MAP[format],
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        // Don't cache export responses
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[docs/export]", err);
    return NextResponse.json(
      { error: "Export failed: " + (err as Error).message },
      { status: 500 },
    );
  }
}
