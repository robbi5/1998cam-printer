const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main.js',
  // Put your normal webpack config below here
  module: {
    rules: require('./webpack.rules'),
  },
  externals: {
    sharp: "commonjs sharp",
  },
  plugins: [
    new CopyPlugin({
      patterns: [{
        context: 'node_modules/pdf-to-printer/dist/',
        from: '*.exe',
        to: './',
      }, {
        context: 'node_modules/regedit/',
        from: 'vbs/*',
        to: '.'
      }]
    })
  ],
};
