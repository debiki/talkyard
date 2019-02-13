/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { logUnusual, dieIf } from './log-and-die';


declare const settings;

function firstDefinedOf(x, y, z?) {
  return !_.isUndefined(x) ? x : (!_.isUndefined(y) ? y : z);
}

function encodeInBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

const utils = {

  firstDefinedOf,

  encodeInBase64,

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
  },

  makeExternalUserFor: (member: Member, opts: {
    externalId: string,
    primaryEmailAddress?: string,
    isEmailAddressVerified?: boolean,
    username?: string,
    fullName?: string,
    avatarUrl?: string,
    aboutUser?: string,
    isAdmin?: boolean,
    isModerator?: boolean,
  }): ExternalUser => {
    return {
      externalUserId: opts.externalId,
      primaryEmailAddress: firstDefinedOf(opts.primaryEmailAddress, member.emailAddress),
      isEmailAddressVerified: firstDefinedOf(opts.isEmailAddressVerified, !!member.emailVerifiedAtMs),
      username: firstDefinedOf(opts.username, member.username),
      fullName: firstDefinedOf(opts.fullName, member.fullName),
      avatarUrl: opts.avatarUrl,
      aboutUser: opts.aboutUser,
      isAdmin: firstDefinedOf(opts.isAdmin, member.isAdmin),
      isModerator: firstDefinedOf(opts.isModerator, member.isModerator),
    };
  },

  tryManyTimes: (what, maxNumTimes, fn) => {
    for (let retryCount = 0; retryCount < maxNumTimes - 1; ++retryCount) {
      try {
        fn();
        return;
      }
      catch (error) {
        logUnusual(`RETRYING: ${what}  [TyME2ERETRY], because error: ${error.toString()}`);
      }
    }
    fn();
  },
};


export = utils;