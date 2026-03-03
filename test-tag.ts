import { revalidateTag } from "next/cache";
revalidateTag("docs", { expire: 0 });
