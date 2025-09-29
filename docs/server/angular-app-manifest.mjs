
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'https://ippon1.github.io/Reparaturbonus/docs/browser/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/Reparaturbonus/docs/browser"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 714, hash: '727b1ee09f182ba26e566965e2b24622a26c58b7ea3df7ef9cd84ec30f2d2907', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1116, hash: '35097357b3337400f7e62ca753fbe958549db8b200aa57fd9144666e7f650445', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 12892, hash: 'cc488fdfc5caa537d44f26e3189085b97ee996aa600678c469820070f072051b', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-OPSORIUJ.css': {size: 11072, hash: '+2rnD5E2+bg', text: () => import('./assets-chunks/styles-OPSORIUJ_css.mjs').then(m => m.default)}
  },
};
