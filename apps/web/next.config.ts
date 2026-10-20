import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@plugin/ui'],
  async redirects() {
    return [
      {
        source: '/gateway',
        destination: '/balances',
        permanent: true
      }
    ];
  }
};

export default nextConfig;
