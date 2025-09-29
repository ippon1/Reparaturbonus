
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'https://ippon1.github.io/Reparaturbonus/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/Reparaturbonus"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 701, hash: 'f9b72da22e1fff5067c8eab172e80017465ea408270e26d3dbabf28d085b1e5e', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1103, hash: 'd536d346eee97363f45b5abc214ff6f03b2c6b8c62fa1ff397b4e4698f633951', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 12879, hash: '845298b35046696a98b144bf57c4fcdae91a6860e780b47947df9d1ae523257e', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-OPSORIUJ.css': {size: 11072, hash: '+2rnD5E2+bg', text: () => import('./assets-chunks/styles-OPSORIUJ_css.mjs').then(m => m.default)}
  },
};
