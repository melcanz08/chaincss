const path = require('path');

module.exports = function withChainCSS(nextConfig = {}) {
  return {
    ...nextConfig,
    webpack(config, options) {
      // Add loader for .jcss files (works in RSC)
      config.module.rules.push({
        test: /\.jcss$/,
        use: [
          options.defaultLoaders.babel,
          {
            loader: path.resolve(__dirname, '../loaders/chaincss-loader.js'),
            options: {
              mode: 'build',  // Build mode for RSC - extracts CSS
              atomic: true
            }
          }
        ]
      });

      // Enable CSS extraction for RSC
      if (options.isServer) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            cacheGroups: {
              styles: {
                name: 'styles',
                type: 'css/mini-extract',
                chunks: 'all',
                enforce: true
              }
            }
          }
        };
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
    
    // Enable CSS support in App Router
    experimental: {
      ...nextConfig.experimental,
      turbo: {
        ...nextConfig.experimental?.turbo,
        rules: {
          ...nextConfig.experimental?.turbo?.rules,
          '*.jcss': {
            loaders: ['chaincss/loader'],
            as: '*.css'
          }
        }
      }
    }
  };
};
const path = require('path');

module.exports = function withChainCSS(nextConfig = {}) {
  return {
    ...nextConfig,
    webpack(config, options) {
      // Add loader for .jcss files (works in RSC)
      config.module.rules.push({
        test: /\.jcss$/,
        use: [
          options.defaultLoaders.babel,
          {
            loader: path.resolve(__dirname, '../loaders/chaincss-loader.js'),
            options: {
              mode: 'build',  // Build mode for RSC - extracts CSS
              atomic: true
            }
          }
        ]
      });

      // Enable CSS extraction for RSC
      if (options.isServer) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            cacheGroups: {
              styles: {
                name: 'styles',
                type: 'css/mini-extract',
                chunks: 'all',
                enforce: true
              }
            }
          }
        };
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }
      return config;
    },
    
    // Enable CSS support in App Router
    experimental: {
      ...nextConfig.experimental,
      turbo: {
        ...nextConfig.experimental?.turbo,
        rules: {
          ...nextConfig.experimental?.turbo?.rules,
          '*.jcss': {
            loaders: ['chaincss/loader'],
            as: '*.css'
          }
        }
      }
    }
  };
};