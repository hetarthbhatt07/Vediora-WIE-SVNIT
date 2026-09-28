/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: process.env.VEDIORA_TEST_BUILD === '1' ? '.next-test' : '.next',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
