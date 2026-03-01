// Root "/" is handled by proxy.ts which redirects to /dashboard or /login.
// This page is a fallback only.
import { redirect } from "next/navigation";
export default function RootPage() {
  redirect("/dashboard");
}
