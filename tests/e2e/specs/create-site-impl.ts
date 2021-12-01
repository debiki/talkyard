/// <reference path="../test-types.ts"/>

import utils = require('../utils/utils');
import settings = require('../utils/settings');



function createPasswordTestData(ps: {  // renamed to generateNewSiteData  in tests/e2e-wdio7/.
  newSiteOwner?: NewSiteOwnerType,
  alreadyLoggedInAtIdProvider?: boolean,
} = {}): NewSiteData {

  const testId = utils.generateTestId();
  const localHostname = utils.getLocalHostname('create-site-' + testId);

  return {
    siteType: SiteType.Forum,
    testId: testId,
    localHostname: localHostname,
    origin: utils.makeSiteOrigin(localHostname),
    //originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
    orgName: "E2E Org Name",
    newSiteOwner: ps.newSiteOwner ||
        // Backw compat, old tests:
        NewSiteOwnerType.OwenOwner,
    alreadyLoggedInAtIdProvider: ps.alreadyLoggedInAtIdProvider,
    fullName: 'E2E Test ' + testId,
    email: settings.testEmailAddressPrefix + testId + '@example.com',
    // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
    username: 'e2e_test_z' + testId,
    password: 'pub5KFV2FY8C',
  }
}

export = createPasswordTestData;
