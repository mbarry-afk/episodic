/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
    ],
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // better-sqlite3 uses native bindings — keep it out of the webpack
      // bundle so Node.js can require() it directly at runtime.
      config.externals.push("better-sqlite3");
    }
    return config;
  },
};

export default nextConfig;
