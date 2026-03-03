import { timingSafeEqual } from "crypto"

function test() {
  const a = Buffer.from("2902211cc6afbb81d7d19a32aa3765e1e570aa21", "utf8");
  const b = Buffer.from("2902211cc6afbb81d7d19a32aa3765e1e570aa21", "utf8");
  return timingSafeEqual(a, b);
}

console.log("Safe equal:", test());
