/// <reference path="../test-types.ts"/>

import { addTestsForConstructingLoadTestSiteAndLoggingIn } from './load-test-site-builder';


describe(`some-e2e-test  TyTE2E1234ABC`, () => {

  addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Load Test Site 100 Pages 60 Users",
    numPages: 100,
    numUsers: 60,
  });

});

