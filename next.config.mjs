/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // mapbox-gl web worker needs this
    config.resolve.alias['mapbox-gl'] = 'mapbox-gl';
    return config;
  },
  // Baseline HTTP security headers — there were none before this. Deliberately NOT including a
  // Content-Security-Policy here: this app pulls Mapbox GL, web fonts and remote images from
  // several origins, and getting that allowlist wrong breaks the map rather than merely
  // hardening it. That is left as a follow-up that can be tested against the real asset list.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Same-origin framing only — this app is never meant to be embedded elsewhere.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop the browser guessing content types away from what the server declared.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send the full referrer to this app's own origin, only the origin cross-site.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deny everything by default except what the app's own origin actually uses:
          // geolocation (siting a farm on the map) and camera (photo capture/upload).
          {
            key: 'Permissions-Policy',
            value:
              'geolocation=(self), camera=(self), fullscreen=(self), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
