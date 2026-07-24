const remotePatterns = [
  {
    protocol: 'https',
    hostname: 'emguadweuzmejmbpmhly.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
  {
    protocol: 'https',
    hostname: '*.supabase.co',
    pathname: '/storage/v1/object/public/**',
  },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    remotePatterns.push({
      protocol: supabaseUrl.protocol.replace(':', ''),
      hostname: supabaseUrl.hostname,
      pathname: '/storage/v1/object/public/**',
    });
  } catch (error) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL has invalid format in next.config.mjs');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  images: {
    remotePatterns,
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/favicon.ico',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
