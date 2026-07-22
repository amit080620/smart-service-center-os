import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@smartbizos/auth',
    '@smartbizos/constants',
    '@smartbizos/database',
    '@smartbizos/permissions',
    '@smartbizos/validation'
  ]
};

export default nextConfig;
