import type { NextConfig } from 'next';

// Circles host loads the miniapp inside an iframe. We need to allow it.
const FRAME_ANCESTORS = [
  "'self'",
  'https://*.gnosis.io',
  'https://*.vercel.app',
].join(' ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${FRAME_ANCESTORS};`,
          },
        ],
      },
    ];
  },
  // Allow IPFS profile images from Circles' gateway and other common sources.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
