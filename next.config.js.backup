/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "expo",
    "react-native-web",
    "expo-status-bar",
    "expo-router",
    "expo-linking",
    "expo-constants",
    "expo-modules-core",
    "@react-native-async-storage/async-storage",
    "react-native-safe-area-context",
    "react-native-screens",
    "react-native-reanimated",
    "expo-linear-gradient",
    "react-native",
  ],
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

    // Add TypeScript support for all .ts and .tsx files
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude:
        /node_modules\/(?!(react-native|@react-native|react-native-.*)\/).*/,
      use: [
        {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-typescript"],
            plugins: [
              ["@babel/plugin-transform-flow-strip-types"],
              ["@babel/plugin-proposal-class-properties", { loose: true }],
              ["@babel/plugin-proposal-private-methods", { loose: true }],
              [
                "@babel/plugin-proposal-private-property-in-object",
                { loose: true },
              ],
            ],
          },
        },
      ],
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
  // Remove experimental features that are causing warnings
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;
