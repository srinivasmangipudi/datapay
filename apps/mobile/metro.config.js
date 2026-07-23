const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm stores packages in a content-addressed store and symlinks them into
// node_modules — most of them pointing OUTSIDE apps/mobile, into the
// monorepo root's node_modules. Metro only watches/resolves what's inside
// its configured folders, so without all three settings below, every import
// resolves to "module could not be found" the moment Metro actually bundles
// (the dev-server manifest still loads fine, which is why this doesn't show
// up until a device/simulator actually tries to run the app). Per Expo's
// official pnpm + monorepo guidance.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
