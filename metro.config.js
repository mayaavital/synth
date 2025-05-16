// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const isModuleIncluded = require('./metro.exclude');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the server directory using multiple approaches
config.resolver.blockList = [
  // Regular expression to exclude server directory
  /server\/.*/
];

// Add a custom resolver to exclude server modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // First check if this is a server module
  if (moduleName.includes('/server/') || moduleName === 'http' || moduleName === 'https') {
    // Return null to indicate we couldn't resolve it, should be excluded
    return null;
  }
  
  // Otherwise, use the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
