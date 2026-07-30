/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project (a stray lockfile in the home dir
  // otherwise makes Next infer the wrong workspace root).
  outputFileTracingRoot: import.meta.dirname,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
