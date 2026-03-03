"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function refreshDocs() {
  // @ts-expect-error Next.js 16 types incorrectly demand a second argument
  revalidateTag("docs");
  revalidatePath("/", "layout");
}
