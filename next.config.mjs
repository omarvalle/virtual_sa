/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ['src'],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
