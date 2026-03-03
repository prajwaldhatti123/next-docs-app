/** @type {import('next').NextConfig} */
const nextConfig = {
  // MDX files in /content are compiled by next-mdx-remote at runtime.
  // We do NOT use @next/mdx for routing — docs are served via app/docs/[...slug].
  // This avoids the Turbopack serializable-options incompatibility with remark/rehype plugins.
  pageExtensions: ['ts', 'tsx'],
  // pdfkit uses Node.js fs internally — keep it out of the webpack bundle
  serverExternalPackages: ['pdfkit'],
  experimental: {},
};

export default nextConfig;

