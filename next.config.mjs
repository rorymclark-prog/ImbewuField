/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // mapbox-gl web worker needs this
    config.resolve.alias['mapbox-gl'] = 'mapbox-gl';
    return config;
  },
};

export default nextConfig;
