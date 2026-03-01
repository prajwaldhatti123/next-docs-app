import { list } from "@vercel/blob";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  console.log("Using Token:", token ? token.substring(0, 20) + "..." : "NONE");
  
  try {
    const res = await list({ token });
    console.log("Total Blobs found:", res.blobs.length);
    res.blobs.forEach(b => console.log(`- ${b.pathname} (${b.size} bytes)`));
  } catch (err) {
    console.error("Error listing blobs:", err);
  }
}

main();
