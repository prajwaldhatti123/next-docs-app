/**
 * PATCH /api/docs/update-stream
 * Update stream metadata (_meta.json). Admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { validateCsrfToken } from "@/lib/security/csrf";
import { updateStreamMeta } from "@/lib/docs/write";
import { revalidatePath } from "next/cache";

const schema = z.object({
  stream: z.string().min(1).max(64),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  color: z.enum(["blue", "purple", "green", "orange", "gray"]).optional(),
});

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin")
    return NextResponse.json(
      { error: "Admin access required" },
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
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );

  const { stream, ...meta } = parsed.data;

  try {
    await updateStreamMeta(stream, meta);
    revalidatePath("/docs", "layout");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[docs/update-stream]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
