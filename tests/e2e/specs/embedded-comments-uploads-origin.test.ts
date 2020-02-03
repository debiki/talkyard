/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');
declare let browser: any;

let everyonesBrowsers;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let siteId: any;


const uplImgLink = (origin: string, sitePubId: string) =>
  `${origin}/-/u/${sitePubId ? sitePubId + '/' : ''}dummyimagepath.jpg`;

const uplFileLinkOne = (origin: string, sitePubId: string) =>
  `${origin}/-/u/${sitePubId ? sitePubId + '/' : ''}dummyfilepathone.pdf`;

const uplFileLinkTwo = (origin: string, sitePubId: string) =>
  `${origin}/-/u/${sitePubId ? sitePubId + '/' : ''}dummyfilepathtwo.pdf`;

const extImgLink  = 'https://elsewhere.example.com/ext-img.jpg';
const extFileLink = 'https://elsewhere.example.com/document.pdf';
const extFile2Link = 'https://galaxytwo.example.com/doctwo.odf';


const mariasImageLinksOrig = `
![uploaded img descr](${uplImgLink('', '')})

![external img descr](${extImgLink})

[uploaded-doc-one.pdf](${uplFileLinkOne('', '')})

<a href="${uplFileLinkTwo('', '')}">uploaded-doc-two.pdf</a>

[external-doc.pdf](${extFileLink})

<a href="${extFile2Link}">external-doc-two.pdf</a>
`;


const mariasImageLinksEdited = mariasImageLinksOrig + "\n\n Extra_text.";



const localHostname = 'comments-for-e2e-test-embuplorg-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embuplorg.localhost:8080';
const pageDddSlug = 'emb-cmts-ddd.html';


describe("emb cmts uploads origin  TyT603RKDJA6", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = everyonesBrowsers;
    maria = make.memberMaria();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embuplorg', { title: "Emb Cmts Upl Orig Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayComposeBeforeSignup = true;
    site.settings.mayPostBeforeEmailVerified = true;
    site.settings.allowGuestLogin = true;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create an embedding pages ddd", () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageDddSlug}`, makeHtml('ddd', '', '#500'));
    function makeHtml(pageName: string, discussionId: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId, localHostname, bgColor });
    }
  });

  it("Maria opens embedding page ddd", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageDddSlug);
  });

  it("Starts writing a reply, when not logged in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... typen image links", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasImageLinksOrig);
  });

  let correctLinksRegexStr: string;

  it("... that get prefixed with the Talkyard server origin, in the preview", () => {
    correctLinksRegexStr =
      'src="' + uplImgLink(idAddress.origin, idAddress.pubId) + '".*' +
      'src="' + extImgLink + '".*' +
      'href="' + uplFileLinkOne(idAddress.origin, idAddress.pubId) + '".*' +
      'href="' + uplFileLinkTwo(idAddress.origin, idAddress.pubId) + '".*' +
      'href="' + extFileLink + '".*' +
      'href="' + extFile2Link + '"';
    mariasBrowser.preview.waitUntilPreviewHtmlMatches(correctLinksRegexStr, { where: 'InPage' });
  });


  it("She clicks Post Reply", () => {
    mariasBrowser.editor.save();
  });

  it("... logs in, to post the comment", () => {
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("The comment is there, with links to the Talkyard server origin", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitUntilPostHtmlMatches(c.FirstReplyNr, correctLinksRegexStr);
  });

  it("... also after reload", () => {
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitUntilPostHtmlMatches(c.FirstReplyNr, correctLinksRegexStr);
  });

  it("Clicks edit", () => {
    mariasBrowser.topic.clickEditoPostNr(c.FirstReplyNr);
  });

  it("... and edits", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasImageLinksEdited);
  });

  it("... and saves", () => {
    mariasBrowser.editor.save();
  });

  it("The links are still okay", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitUntilPostHtmlMatches(
        c.FirstReplyNr, correctLinksRegexStr + '.*Extra_text');
  });

  it("... also after reload, this time too", () => {
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitUntilPostHtmlMatches(c.FirstReplyNr,
        correctLinksRegexStr + '.*Extra_text');
  });


  // ----- Add image, directly via Talkyards server

  it("Maria goes to the Talkard server, the topics list", () => {
    mariasBrowser.go2(idAddress.origin);
  });

  it("She posts a new topic, with the same links", () => {
    mariasBrowser.complex.createAndSaveTopic({
      title: "Maria's Topic, not embedded",
      body: mariasImageLinksOrig,
      bodyMatchAfter: false,
    });
  });

  let correctLinksRegexStrNoOrigin: string;

  it("The links don't get prefixed with the Talkyard server origin — not needed, not embedded", () => {
    correctLinksRegexStrNoOrigin =
        'src="' + uplImgLink('', idAddress.pubId) + '".*' +
        'src="' + extImgLink + '".*' +
        'href="' + uplFileLinkOne('', idAddress.pubId) + '".*' +
        'href="' + uplFileLinkTwo('', idAddress.pubId) + '".*' +
        'href="' + extFileLink + '".*' +
        'href="' + extFile2Link + '"';
    mariasBrowser.topic.waitUntilPostHtmlMatches(c.BodyNr, correctLinksRegexStrNoOrigin);
  });

  it("She posts a reply", () => {
    mariasBrowser.complex.replyToOrigPost(mariasImageLinksOrig);
  });

  it("The links in the reply also don't get prefixed with the Talkyard server origin", () => {
    mariasBrowser.topic.waitUntilPostHtmlMatches(c.FirstReplyNr, correctLinksRegexStrNoOrigin);
  });

});

