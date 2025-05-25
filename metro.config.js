const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add custom resolver configuration
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    "react-native-svg": require.resolve("react-native-svg"),
  },
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.startsWith("../../../../../..")) {
      return {
        filePath: require.resolve("react-native-svg"),
        type: "sourceFile",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
