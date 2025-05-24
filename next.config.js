/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["expo", "react-native-web"],
  webpack: (config, { isServer }) => {
    // Handle the fs module issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    // Add React Native Web alias
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-native$": "react-native-web",
      "react-native-web": "react-native-web",
    };

    // Add support for importing SVG files
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    // Ignore specific warnings
    config.ignoreWarnings = [
      { module: /node_modules\/expo-router/ },
      {
        message:
          /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
  // Add experimental features
  experimental: {
    esmExternals: "loose",
  },
};

module.exports = nextConfig;
