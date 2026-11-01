/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  },
  webpack: (config, { isServer }) => {
    // Remotion renderer or binary handling if needed
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
