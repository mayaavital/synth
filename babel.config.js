module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            // Add aliases for your app imports
            '@app': './app',
            '@components': './components',
            '@assets': './assets',
            '@utils': './utils',
          }
        }
      ]
    ],
    // Add this to tell Metro bundler to ignore Node.js built-in modules
    overrides: [
      {
        test: ['./server/**/*.js'],
        ignore: ['**/*']
      }
    ]
  };
}; 