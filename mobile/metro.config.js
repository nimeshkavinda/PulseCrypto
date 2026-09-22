/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from both mobile/node_modules and hoisted root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Handle TypeScript ESM .js extension imports in monorepo packages
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith('.js')) {
      const tsModuleName = moduleName.slice(0, -3) + '.ts';
      try {
        return (defaultResolveRequest || context.resolveRequest)(context, tsModuleName, platform);
      } catch {
        const tsxModuleName = moduleName.slice(0, -3) + '.tsx';
        try {
          return (defaultResolveRequest || context.resolveRequest)(context, tsxModuleName, platform);
        } catch {
          // Fall through
        }
      }
    }
    throw error;
  }
};

module.exports = config;
