/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  maxDuration: 90,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com", pathname: "/**" },
      { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },
  webpack: (config) => {
    config.resolve.alias["canvas"] = false;
    config.resolve.alias["encoding"] = false;
    return config;
  },
};

export default nextConfig;
