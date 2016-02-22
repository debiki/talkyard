/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>

import assert = require('assert');
import settings = require('./settings');

function regexEscapeSlashes(origin) {
  return origin.replace(/\//g, '\\/');
}


var utils = {

  generateTestId: function() {
    return Date.now().toString().slice(3, 10);
  },

  makeSiteOrigin: function(localHostname) {
    return settings.scheme + '://' + localHostname + '.' + settings.newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname) {
    return settings.scheme + ':\\/\\/' + localHostname + '.' + settings.newSiteDomain;
  },

  makeCreateSiteWithFakeIpUrl: function () {
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    var ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();
    return settings.mainSiteOrigin + '/-/create-site?fakeIp=' + ip +
        '&e2eTestPassword=' + settings.e2eTestPassword + '&testSiteOkDelete=true';
  },

  findFirstLinkToUrlIn: function(url, text) {
    var regexString = regexEscapeSlashes(url) + '[^"]*';
    var matches = text.match(new RegExp(regexString));
    if (!matches) {
      assert.fail(text, regexString,
          "No link matching " + regexString + " found in email [EsE5GPYK2]");
    }
    else {
      return matches[0];
    }
  }
};


export = utils;