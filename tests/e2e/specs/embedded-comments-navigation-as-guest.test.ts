/// <reference path="../test-types.ts"/>

import navAsSomeoneTests = require('./navigation-as-impl');

declare let browser: any;

navAsSomeoneTests((browser) => {    // TyT2P067WKT2
  return {
    fullName: 'Greta Gäst',
    isGuest: true,
  };
});

