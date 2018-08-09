/// <reference path="../test-types.ts"/>

import navAsSomeoneTests = require('./navigation-as-impl');

declare let browser: any;

navAsSomeoneTests((browser) => {   // TyT7WAAR2J4
  return {
    member: 'alice',
    memberIsAdmin: true,
  };
});

