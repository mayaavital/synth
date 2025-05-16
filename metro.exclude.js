// This helper identifies paths that should be excluded from bundling
module.exports = function isBundled(originModulePath, targetModulePath) {
  // If either path contains /server/ directory, don't bundle it
  const isServerFile = /\/server\//.test(targetModulePath) || /\/server\//.test(originModulePath);
  
  // If it's a server file or node built-in module (like 'http'), don't bundle it
  return !isServerFile;
}; 