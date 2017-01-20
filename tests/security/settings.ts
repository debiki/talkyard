//xx <reference path="../../../../modules/definitely-typed/minimist/minimist.d.ts"/>

import _ = require('lodash');
import minimist = require('minimist');

var settings: any = {
  host: 'localhost',
  // Default passwords, for testing on localhost.
  e2eTestPassword: 'public',
  forbiddenPassword: 'public',
};


var args: any = minimist(process.argv.slice(2));
_.extend(settings, args);

settings.scheme = settings.secure ? 'https' : 'http';
settings.mainSiteOrigin = settings.scheme + '://' + settings.host;
settings.newSiteDomain = settings.newSiteDomain || settings.host;

// (These local hostnames are declared here: [7PKW4R2] if you're running everything in
// Docker-Compose.)
settings.testSiteOrigin1 = settings.scheme + '://test-site-1.' + settings.host;
settings.testSiteOrigin2 = settings.scheme + '://test-site-2.' + settings.host;
settings.testSiteOrigin3 = settings.scheme + '://test-site-3.' + settings.host;
settings.testSiteOrigin4 = settings.scheme + '://test-site-4.' + settings.host;
settings.testSiteOrigin5 = settings.scheme + '://test-site-5.' + settings.host;
settings.testSiteOrigin6 = settings.scheme + '://test-site-6.' + settings.host;
settings.testSiteOrigin7 = settings.scheme + '://test-site-7.' + settings.host;
settings.testSiteOrigin8 = settings.scheme + '://test-site-8.' + settings.host;
settings.testSiteOrigin9 = settings.scheme + '://test-site-9.' + settings.host;



export = settings;
