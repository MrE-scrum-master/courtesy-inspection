const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable symlinks
config.resolver.unstable_enableSymlinks = true;

module.exports = config;