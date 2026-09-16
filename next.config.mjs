/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  reactStrictMode: true,
  // Pin the tracing root to this project (a stray lockfile in the home dir
  // otherwise makes Next infer the wrong workspace root).
  outputFileTracingRoot: import.meta.dirname,
  // The shared layout reads this font to embed it in the glass backdrop.
  // Static asset hosting alone does not make it available to serverless code.
  outputFileTracingIncludes: {
    "/*": ["./public/fonts/dm-sans-latin.woff2"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
