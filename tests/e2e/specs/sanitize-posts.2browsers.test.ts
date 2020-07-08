/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as nodeAssert from 'assert';
import tyAssert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoPagesTestForum;

/*

Resources for more exhaustive testing:  [sec_tst_rscs]

OWASP Cheat Sheet Series
https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

XSS Filter Evasion Cheat Sheet
https://owasp.org/www-community/xss-filter-evasion-cheatsheet

HTML5 Security Cheatsheet  (https://html5sec.org/)
https://github.com/cure53/H5SC

Collection of different types of lists for security testing
https://github.com/danielmiessler/SecLists

Dictionary of attacks etc
https://github.com/fuzzdb-project/fuzzdb

OWASP Zed Attack Proxy (ZAP) — open source web app scanner
https://github.com/zaproxy

*/


describe("sanitize-posts  TyT603RMDL3", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: ['mallory', 'maria', 'michael'],
    });
    tyAssert.refEq(builder.getSite(), forum.siteData);
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserB;
  });

  /*
  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.goToUsersEnabled(site.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  }); */

  it("Mallory logs in", () => {
    mallorysBrowser.go2(site.origin);
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("Mallory posts an XSS and Other Attacks topic", () => {
    mallorysBrowser.complex.createAndSaveTopic({
          title: 'XSS Attacks and More',
          body: `Let me try` });
  });


  const attackStrOne = (sanitized: 'Sanitized' | 'NotSanitized'): string => {
    const danger = sanitized !== 'Sanitized';

    // See list of more resources above. [sec_tst_rscs]

    // This dedicated newline variable makes it clear that the new line is
    // intentional. The newline places the thing after in a new paragraph.
    const newline = '\n';

    return `
<p>Removes script tags</p>
${danger ? `
<script>alert(1)</script>` : ``}


<p>Removes img script attr</p>
${danger ? `
<IMG SRC="javascript:alert('XSS');">
<IMG SRC="  javascript:alert('XSS');">
<IMG SRC=" &#14;  javascript:alert('XSS');">` : `
<img>
<img>
<img>`}


<p>Removes js event attrs</p>
${danger ? `
<a id=x tabindex=1 onfocus=alert(1)>Focy</a>
${newline}
<a onclick="alert(1)">Clicky</a>`
: `
<a id="x" rel="nofollow">Focy</a>${//  could skip nofollow here, but no, small bug risk
newline}
<a rel="nofollow">Clicky</a>`}


<p>Adds rel=nofollow to external links TyTRELNOFLW01</p>
${danger ? `
<a href="https://bad.com">Don't follow</a>` : `
<a href="https://bad.com" rel="nofollow">Don't follow</a>`}
${danger ? `
[CommonMark ext link](https://ext.com/ext-page)` : `
<a href="https://ext.com/ext-page" rel="nofollow">CommonMark ext link</a>`}


<p>Won't add rel=nofollow to internal links TyTRELNOFLW01</p>
${newline}
<a href="/-other-page-here">Other page here</a>
${danger ? `
[CommonMark Int Link](/local-page)` : `
<a href="/local-page">CommonMark Int Link</a>`}


<p>Adds rel=nofollow noopener if target=_blank TyTREVTABNAB01</p>
${danger ? `
<a href="https://bad.com" target="_blank">Target blank</a>` : `
<a href="https://bad.com" target="_blank" rel="nofollow noopener">Target blank</a>`}


<p>Adds noopener if target=_blank and rel=nofollow already  TyTREVTABNAB01</p>
${danger ? `
<a href="https://bad.com" target="_blank" rel="nofollow">Target blank</a>` : `
<a href="https://bad.com" target="_blank" rel="nofollow noopener">Target blank</a>`}


<p>Adds nofollow if target=_blank and rel=noopener already  TyTREVTABNAB01</p>
${danger ? `
<a href="https://bad.com" target="_blank" rel="noopener">Target blank</a>` : `
<a href="https://bad.com" target="_blank" rel="nofollow noopener">Target blank</a>`}

    `.trim();
  };


  it(`Mallory posts attackStrOne`, () => {
    const attackStr = attackStrOne('NotSanitized');
    tyAssert.includes(attackStr, '<script>alert(1)</script>');  // test the test
    mallorysBrowser.complex.replyToOrigPost(attackStr);
  });


  it(`... It got properly sanitized`, () => {
    const safeStr = attackStrOne('Sanitized');
    tyAssert.includes(safeStr, 'noopener">Target blank');  // test the test
    const sanitizedHtml = mallorysBrowser.topic.getPostHtml(c.FirstReplyNr)
    nodeAssert.strictEqual(
            removeBlankLines(sanitizedHtml),
            removeBlankLines(
                '<div class="dw-p-bd-blk">' + safeStr + '\n</div>',
                'AndWrapInParas'));
  });

});



function removeBlankLines(str: string, wrap?: 'AndWrapInParas'): string {
  const lines = str.split('\n');
  let result = lines.filter(line => line.trim().length).join('\n');

  // CommonMark wraps an <a> on its own line in a <p>.
  if (wrap === 'AndWrapInParas') {
    result = result.replace(/<a /g, '<p><a ');
    result = result.replace(/<\/a>/g, '</a></p>');
  }

  return result;
}