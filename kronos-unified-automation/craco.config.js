const path = require('path');

module.exports = {
  webpack: {
    configure: (config) => {
      // Allow imports outside src (for shared packages/electron code)
      config.resolve.plugins = (config.resolve.plugins || []).filter(
        (plugin) => plugin.constructor && plugin.constructor.name !== 'ModuleScopePlugin'
      );
      // Preserve existing aliases if any
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': path.resolve(__dirname, 'src')
      };
      return config;
    }
  }
};
