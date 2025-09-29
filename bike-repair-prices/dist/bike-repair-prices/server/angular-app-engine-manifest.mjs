
export default {
  basePath: 'https://ippon1.github.io/Reparaturbonus',
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
