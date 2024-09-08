const fs = require('fs');

const sumatra = fs.readdirSync('node_modules/pdf-to-printer/dist/').find(e => e.endsWith('.exe'));

module.exports = {
  packagerConfig: {
    extraResource: [
      `node_modules/pdf-to-printer/dist/${sumatra}`,
      `node_modules/regedit/vbs`
    ]
  },
  rebuildConfig: {},
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: {
      name: 'label-terminal-win32-x64'
    }
  }],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        devContentSecurityPolicy: `default-src * data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'`,
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
  ],
};
