// The domain code (analysis, strategy, concepts, exercises, storage…) is
// shared with the website: it lives in ../src, imported as @shared/…
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '..', 'src')

const config = getDefaultConfig(projectRoot)
// Added to the defaults (the app itself must stay watched).
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot]

// Packages imported by the shared code (chess.js…) resolve from this app, so
// that the bundle holds a single copy of each.
const resolveFromApp = path.join(projectRoot, 'index.js')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName) && !moduleName.startsWith('@shared/')
  if (bare && context.originModulePath.startsWith(sharedRoot)) {
    return context.resolveRequest({ ...context, originModulePath: resolveFromApp }, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

// Stockfish ships inside the app (assets/engine, copied by `npm run sync:engine`):
// the WASM and its loader (renamed .sfjs so Metro bundles it as a file, not code).
config.resolver.assetExts.push('wasm', 'sfjs')

module.exports = config
