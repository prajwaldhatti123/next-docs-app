/**
 * GET /api/docs/raw?stream=tech&slug=backend/rbac
 * Returns the raw MDX source of a doc. Writer/admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readRawDoc } from "@/lib/docs/write";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "reader")
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 },
    );

  const { searchParams } = new URL(request.url);
  const stream = searchParams.get("stream") ?? "";
  const slugStr = searchParams.get("slug") ?? "";

  if (!stream || !slugStr)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // Access check: admin can read any stream, writer must have that stream
  if (session.role === "writer" && !session.teams.includes(stream)) {
    return NextResponse.json(
      { error: "No access to this stream" },
      { status: 403 },
    );
  }

  const slug = slugStr.split("/").filter(Boolean);
  const raw = await readRawDoc(stream, slug);

  if (!raw)
    return NextResponse.json({ error: "Doc not found" }, { status: 404 });

  return NextResponse.json({ content: raw }, { status: 200 });
}
