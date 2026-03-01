"use server";

import { revalidatePath } from "next/cache";

export async function refreshDocs() {
  revalidatePath("/", "layout");
}
