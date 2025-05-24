module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo", "@babel/preset-typescript"],
    plugins: [
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            // Add aliases for your app imports
            "@app": "./app",
            "@components": "./components",
            "@assets": "./assets",
            "@utils": "./utils",
            "react-native$": "react-native-web",
            "expo-linear-gradient": "expo-linear-gradient",
          },
        },
      ],
    ],
    // Add this to tell Metro bundler to ignore Node.js built-in modules
    overrides: [
      {
        test: ["./server/**/*.js"],
        ignore: ["**/*"],
      },
    ],
  };
};
