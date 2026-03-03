/**
 * POST /api/docs/create
 * Create a new doc (any format), folder, or stream.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { validateCsrfToken } from "@/lib/security/csrf";
import { createDoc, createFolder, createStream } from "@/lib/docs/write";
import { revalidatePath } from "next/cache";

const baseSchema = z.object({
  type: z.enum(["doc", "folder", "stream"]),
  stream: z.string().max(64).optional(),
  slugPath: z.array(z.string().max(128)).max(10).optional(),
  title: z.string().min(1).max(200),
  format: z.enum(["mdx", "html", "tex"]).optional().default("mdx"),
  meta: z
    .object({
      description: z.string().max(500).optional().default(""),
      icon: z.string().max(10).optional().default("📄"),
      color: z
        .enum(["blue", "purple", "green", "orange", "gray"])
        .optional()
        .default("gray"),
    })
    .optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "reader")
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 },
    );
  if (!validateCsrfToken(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = baseSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );

  const { type, stream, slugPath, title, format, meta } = parsed.data;

  try {
    if (type === "stream") {
      if (session.role !== "admin")
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      await createStream(title, {
        label: title,
        description: meta?.description ?? "",
        icon: meta?.icon ?? "📄",
        color: meta?.color ?? "gray",
      });
      revalidatePath("/docs", "layout");
      return NextResponse.json({
        success: true,
        stream: title.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
      });
    }

    if (!stream)
      return NextResponse.json(
        { error: "stream is required" },
        { status: 400 },
      );

    if (session.role === "writer" && !session.teams.includes(stream))
      return NextResponse.json(
        { error: "No write access to this stream" },
        { status: 403 },
      );

    const path = slugPath ?? [];

    if (type === "folder") {
      await createFolder(stream, path, title);
      revalidatePath("/docs", "layout");
      return NextResponse.json({ success: true, slug: path.join("/") });
    }

    // type === 'doc'
    const { slug } = await createDoc(stream, path, title, format);
    revalidatePath("/docs", "layout");
    return NextResponse.json({ success: true, slug: slug.join("/"), format });
  } catch (err) {
    console.error("[docs/create]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
