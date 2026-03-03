/**
 * POST /api/docs/save
 * Save (overwrite) an existing doc. Accepts any format.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { validateCsrfToken } from "@/lib/security/csrf";
import { saveDoc } from "@/lib/docs/write";
import { revalidatePath } from "next/cache";

const schema = z.object({
  stream: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  slug: z.array(z.string().min(1).max(128)).min(1).max(10),
  content: z.string().min(1).max(2_000_000), // 2 MB max (LaTeX/HTML can be larger)
  format: z.enum(["mdx", "html", "tex"]).optional().default("mdx"),
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

  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { stream, slug, content, format } = parsed.data;

  if (session.role === "writer" && !session.teams.includes(stream))
    return NextResponse.json(
      { error: "No write access to this stream" },
      { status: 403 },
    );

  try {
    await saveDoc(stream, slug, content, format);
    revalidatePath("/docs", "layout");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[docs/save]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
