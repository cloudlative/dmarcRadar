/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["imapflow", "mailparser", "adm-zip"],
  },
};

export default nextConfig;
