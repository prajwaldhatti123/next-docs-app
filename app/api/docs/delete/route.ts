/**
 * DELETE /api/docs/delete
 * Delete a doc file, folder, or entire stream.
 *
 * Body: { type: 'doc'|'folder'|'stream', stream?, slugPath?, title? }
 * - doc/folder: writer with stream access OR admin
 * - stream: admin only
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { validateCsrfToken } from "@/lib/security/csrf";
import { deleteDoc, deleteFolder, deleteStream } from "@/lib/docs/write";
import { revalidatePath } from "next/cache";

const schema = z.object({
  type: z.enum(["doc", "folder", "stream"]),
  stream: z.string().max(64).optional(),
  slugPath: z.array(z.string().max(128)).max(10).optional(),
});

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

  const { type, stream, slugPath } = parsed.data;

  try {
    if (type === "stream") {
      if (session.role !== "admin")
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      if (!stream)
        return NextResponse.json(
          { error: "stream is required" },
          { status: 400 },
        );
      await deleteStream(stream);
      revalidatePath("/docs", "layout");
      return NextResponse.json({ success: true });
    }

    if (!stream)
      return NextResponse.json(
        { error: "stream is required" },
        { status: 400 },
      );
    if (session.role === "writer" && !session.teams.includes(stream)) {
      return NextResponse.json(
        { error: "No write access to this stream" },
        { status: 403 },
      );
    }

    const p = slugPath ?? [];

    if (type === "folder") {
      await deleteFolder(stream, p);
    } else {
      await deleteDoc(stream, p);
    }

    revalidatePath("/docs", "layout");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[docs/delete]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
