// node/plugins/next-plugin.js
const path = require('path');

module.exports = function withChainCSS(nextConfig = {}) {
  return {
    ...nextConfig,
    webpack(config, options) {
      config.module.rules.push({
        test: /\.jcss$/,
        use: [
          options.defaultLoaders.babel,
          {
            loader: path.resolve(__dirname, '../loaders/chaincss-loader.js'),
            options: {
              mode: process.env.NODE_ENV === 'production' ? 'build' : 'runtime',
              atomic: process.env.NODE_ENV === 'production'
            }
          }
        ]
      });

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
    pageExtensions: [...(nextConfig.pageExtensions || []), 'jcss']
  };
};