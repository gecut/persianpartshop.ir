// Architecture guard for `pnpm check:deps` (see AGENTS.md §5.4). Type-only imports are ignored:
// they are erased at build time and cannot create load-order cycles.

const web = 'apps/web/src'

// Non-view files of a web module may import only modules in earlier layers.
// `*.view.tsx` files are composition roots and may compose any feature.
const webLayers = [
  ['auth'],
  ['pwa'],
  ['account', 'catalog'],
  ['orders'],
  ['cart'],
  ['checkout'],
  ['supply-requests'],
  ['products'],
  ['plans'],
]

const layerRules = webLayers.flatMap((layer, index) => {
  const later = webLayers.slice(index + 1).flat()
  if (!later.length) return []
  return [{
    name: `web-layer-${layer.join('-')}`,
    comment: `${layer.join(', ')} must not import later layers (${later.join(', ')}) outside *.view.tsx`,
    severity: 'error',
    from: { path: `^${web}/modules/(${layer.join('|')})/`, pathNot: '\\.view\\.tsx$' },
    to: { path: `^${web}/modules/(${later.join('|')})/` },
  }]
})

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Runtime import cycles break module initialisation order and HMR.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'web-shared-layers-stay-generic',
      comment: 'lib/ and components/ must not import modules/, app/ or routes/.',
      severity: 'error',
      from: { path: `^${web}/(lib|components)/` },
      to: { path: `^${web}/(modules|app|routes)/` },
    },
    {
      name: 'web-lib-is-ui-free',
      comment: 'lib/ holds infrastructure and utilities; UI is registered from the app entry instead.',
      severity: 'error',
      from: { path: `^${web}/lib/` },
      to: { path: `^${web}/components/` },
    },
    {
      name: 'web-modules-not-app-or-routes',
      comment: 'Feature modules never import the application shell or route files.',
      severity: 'error',
      from: { path: `^${web}/modules/` },
      to: { path: `^${web}/(app|routes)/` },
    },
    {
      name: 'web-module-private-files',
      comment: 'Files starting with _ are private to their own module.',
      severity: 'error',
      from: { path: `^${web}/modules/([^/]+)/` },
      to: { path: `^${web}/modules/.+/_[^/]+$`, pathNot: `^${web}/modules/$1/` },
    },
    ...layerRules,
    {
      name: 'api-lib-stays-infrastructure',
      comment: 'apps/api/src/lib must not import routers or rpc.',
      severity: 'error',
      from: { path: '^apps/api/src/lib/' },
      to: { path: '^apps/api/src/(routers|rpc)/' },
    },
    {
      name: 'cms-lib-stays-generic',
      comment: 'apps/cms/src/lib must not import collections.',
      severity: 'error',
      from: { path: '^apps/cms/src/lib/' },
      to: { path: '^apps/cms/src/collections/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.test\\.tsx?$|/routeTree\\.gen\\.ts$|/payload-types\\.ts$|/migrations/)' },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
}
