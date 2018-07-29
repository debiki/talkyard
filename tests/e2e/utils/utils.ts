import { dieIf } from './log-and-die'

declare const settings;


const utils = {

  regexEscapeSlashes: function(origin: string): string {
    return origin.replace(/\//g, '\\/');
  },

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
    return utils._makeCreateSiteUrlImpl(false);
  },

  makeCreateEmbeddedSiteWithFakeIpUrl: function () {
    return utils._makeCreateSiteUrlImpl(true);
  },

  _makeCreateSiteUrlImpl: function (isEmbeddedSite: boolean) {
    function randomIpPart() { return '.' + Math.floor(Math.random() * 256); }
    const ip = '0' + randomIpPart() + randomIpPart() + randomIpPart();
    const embedded = isEmbeddedSite ? '/embedded-comments' : '';
    return settings.mainSiteOrigin + `/-/create-site${embedded}?fakeIp=${ip}` +
        `&e2eTestPassword=${settings.e2eTestPassword}&testSiteOkDelete=true`;
  },

  findFirstLinkToUrlIn: function(url: string, text: string): string {
    return utils._findFirstLinkToUrlImpl(url, text, true);
  },

  findAnyFirstLinkToUrlIn: function(url: string, text: string): string {
    return utils._findFirstLinkToUrlImpl(url, text, false);
  },

  _findFirstLinkToUrlImpl: function(url: string, text: string, mustMatch: boolean): string {
    // Make sure ends with ", otherwise might find: <a href="..">http://this..instead..of..the..href</a>.
    // This:  (?: ...)  is a non-capture group, so the trailing " won't be incl in the match.
    const regexString = '(' + utils.regexEscapeSlashes(url) + '[^"\']*)(?:["\'])';
    const matches = text.match(new RegExp(regexString));
    dieIf(mustMatch && !matches,
        `No link matching /${regexString}/ found in email [EsE5GPYK2], text: ${text}`);
    return matches ? matches[1] : undefined;
  }
};


export = utils;