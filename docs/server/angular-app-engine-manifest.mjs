
export default {
  basePath: 'https://ippon1.github.io/Reparaturbonus/docs/browser',
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
