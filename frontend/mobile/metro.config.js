const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const workspacePackages = [
  path.join(workspaceRoot, 'packages', 'api-client') + path.sep,
  path.join(workspaceRoot, 'packages', 'analytics') + path.sep,
]

const config = getDefaultConfig(projectRoot)

// Keep Expo defaults and add the monorepo root for workspace packages.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Workspace packages use NodeNext `.js` import specifiers in TypeScript
// source. When Metro resolves `src/` (dist is gitignored / missing on EAS),
// rewrite those relative `.js` imports to `.ts`.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath || ''
  const fromWorkspaceSrc = workspacePackages.some(
    (pkgRoot) =>
      origin.startsWith(pkgRoot) && origin.includes(`${path.sep}src${path.sep}`),
  )
  if (fromWorkspaceSrc && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName.replace(/\.js$/, '.ts'), platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
