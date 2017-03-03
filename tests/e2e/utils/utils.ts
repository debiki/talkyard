import assert = require('assert');
import settings = require('./settings');
import { dieIf } from './log-and-die'

function regexEscapeSlashes(origin: string): string {
  return origin.replace(/\//g, '\\/');
}


const utils = {

  generateTestId: function(): string {
    return Date.now().toString().slice(3, 10);
  },

  makeSiteOrigin: function(localHostname: string): string {
    return settings.scheme + '://' + localHostname + '.' + settings.newSiteDomain;
  },

  makeSiteOriginRegexEscaped: function(localHostname: string): string {
    return settings.scheme + ':\\/\\/' + localHostname + '.' + settings.newSiteDomain;
  },

  makeCreateSiteWithFakeIpUrl: function () {
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    const ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();
    return settings.mainSiteOrigin + '/-/create-site?fakeIp=' + ip +
        '&e2eTestPassword=' + settings.e2eTestPassword + '&testSiteOkDelete=true';
  },

  findFirstLinkToUrlIn: function(url: string, text: string): string {
    const regexString = regexEscapeSlashes(url) + '[^"]*';
    const matches = text.match(new RegExp(regexString));
    dieIf(!matches, `No link matching /${regexString}/ found in email [EsE5GPYK2], text: ${text}`);
    return matches[0];
  }
};


export = utils;