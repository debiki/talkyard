/// <reference path="../test-types.ts"/>

import navAsSomeoneTests = require('./navigation-as-impl');

declare let browser: any;

navAsSomeoneTests((browser) => {
  return {
    member: null,
  };
});

