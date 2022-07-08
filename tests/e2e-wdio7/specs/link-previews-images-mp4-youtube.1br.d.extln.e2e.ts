/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import * as make from '../utils/make';
import c from '../test-constants';


let browser: TyE2eTestBrowser;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
const forumTitle = "Editor Link Preview Forum";
const oneboxTopicTitle = "Link Preview Topic Title";

const dotOneboxClass = '.s_LnPv';

// Test links:

// The server should change this link to https, if the server uses https.
// [no_insec_emb] [E2EHTTPS]
const slashImageJpgUrl = '//www.example.com/image.jpg';
const httpImageJpgUrl = `http:${slashImageJpgUrl}`;
const httpsImageJpgUrl = `https:${slashImageJpgUrl}`;
const imageJpgUrl = `${settings.scheme}:${slashImageJpgUrl}`;

// Let's use some more http links, unless the server uses https. [E2EHTTPS]
const imagePngUrl = `${settings.scheme}://www.example.com/image.png`;  // http, sometimes
const imageGifUrl = `${settings.scheme}://www.example.com/image.gif`;  //

const videoMp4Url = 'https://www.example.com/video.mp4';
const videoYouTubeIdInvalid = 'https://www.youtube.com/watch?v=DAR27FWzyZY';
const videoYouTubeId = 'DAR27FWzyZY';
const videoYouTubeUrl = `https://www.youtube.com/watch?v=${videoYouTubeId}`;
const videoYouTubeUrlInvalidId = `https://www.youtube.com/watch?v=${videoYouTubeIdInvalid}`;
const imageJpgOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imageJpgUrl}"] img[src="${imageJpgUrl}"]`;
const imagePngOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imagePngUrl}"] img[src="${imagePngUrl}"]`;
const imageGifOnebox = `aside.s_LnPv.s_LnPv-Img a[href="${imageGifUrl}"] img[src="${imageGifUrl}"]`;
const videoMp4Onebox = `aside.s_LnPv.s_LnPv-Video video[src="${videoMp4Url}"]`;
const videoYouTubeOnebox =
    `aside.s_LnPv.s_LnPv-YouTube iframe[src^="https://www.youtube.com/embed/${videoYouTubeId}"]`;


// Don't change http: outside any links:
const httpButNotALinkSource = `
Don't change http: in plain text, e.g.: http://not_a_link, or in code blocks,
or in the wrong attributes:

\`\`\`
http://url-in-code-block.ex.co/img.jpg?q=http://sth.ex.co
\`\`\`

<a name="http://wrong-attr.ex.co/img.jpg" href="#">http://wrong.ex.co</a>

But yes, do change real links:

<a href="${httpImageJpgUrl}">text</a>

${httpImageJpgUrl}
`;

const httpButNotALinkRegexs = [
      'http: in plain text',
      'http://not_a_link,',
      'http://url-in-code-block.ex.co/img.jpg?q=http://sth.ex.co',
      'name="http://wrong-attr.ex.co/img.jpg"',
      '>http://wrong.ex.co</a>'];
      // However, httpImageJpgUrl gets changed to: imageJpgUrl   [E2EHTTPS]



const inPagePreviewSelector = '.s_P-Prvw ';
const inEditorPreviewSelector = '#debiki-editor-controller .preview ';


// Also try w real pics & vids:  TESTS_MISSING
//  https://preview.redd.it/7fig79vdq4451.png?width=640&height=640&crop=smart&auto=webp&s=548214ef563f762152ab1c0733b37fbf16bad3c8
//  http://techslides.com/demos/sample-videos/small.mp4
// verify does resize & show?


describe("link-previews-images-mp4-youtube.1br.extln  TyTE2E2G3MAWKT4", () => {

  it("initialize people", async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    everyone = browser;
    owen = make.memberOwenOwner();
    owensBrowser = browser;
    maria = make.memberMaria();
    mariasBrowser = browser;
  });

  it("import a site", async () => {
    let site: SiteData = make.forumOwnedByOwen('edr-ln-pv', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.members.push(maria);
    idAddress = await server.importSiteData(site);
  });

  it("Owen goes to the homepage and logs in", async () => {
    await owensBrowser.go2(idAddress.origin);
    await owensBrowser.assertPageTitleMatches(forumTitle);
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Owen opens the create-topic editor", async () => {
    await owensBrowser.forumButtons.clickCreateTopic();
  });

  it("Owen types a title and an image url", async () => {
    await owensBrowser.editor.editTitle(oneboxTopicTitle);
    assert.ok(httpImageJpgUrl.startsWith('http://'))
    await owensBrowser.editor.editText(httpImageJpgUrl);  // will change to https
  });

  it("The image url gets converted to a .s_LnPv tag", async () => {
    await owensBrowser.preview.waitForExist(dotOneboxClass, { where: 'InEditor' });
    await owensBrowser.waitForExist(inEditorPreviewSelector + dotOneboxClass);  // CLEAN_UP remove
  });

  it("... with an a[href=...] and img[src=...]", async () => {
    // httpImageJpgUrl should have gotten changed to https, iff the server uses https:
    if (settings.scheme === 'https:') {
      assert.ok(imageJpgOnebox.includes('https:'));
      assert.ok(!imageJpgOnebox.includes('http:'));
    }
    await owensBrowser.preview.waitForExist(imageJpgOnebox, { where: 'InEditor' });
    await owensBrowser.waitForExist(inEditorPreviewSelector + imageJpgOnebox);  // CLEAN_UP remove
  });

  it("Owen saves the page", async () => {
    await owensBrowser.rememberCurrentUrl();
    await owensBrowser.editor.save();
    await owensBrowser.waitForNewUrl();
    await owensBrowser.assertPageTitleMatches(oneboxTopicTitle);
  });

  it("... and sees the link preview <img> tag", async () => {
    await owensBrowser.waitForExist('.esOrigPost ' + dotOneboxClass);
    await owensBrowser.waitForExist('.esOrigPost ' + imageJpgOnebox);
  });

  it("Owen edits the page, adds a video url", async () => {
    await owensBrowser.topic.clickEditOrigPost();
    await owensBrowser.editor.editText(videoMp4Url, { checkAndRetry: true });
  });

  it("It appears as a link preview <video> tag in the preview", async () => {
    await owensBrowser.preview.waitForExist(dotOneboxClass, { where: 'InPage' });
    await owensBrowser.waitForExist(inPagePreviewSelector + dotOneboxClass);  // CLEAN_UP remove

    await owensBrowser.preview.waitForExist(videoMp4Onebox, { where: 'InPage' });
    await owensBrowser.waitForExist(inPagePreviewSelector + videoMp4Onebox);  // CLEAN_UP remove
  });

  it("Owen saves the edits, sees both the preview <img> and the <video> tags", async () => {
    await owensBrowser.editor.save();
    await owensBrowser.waitForExist('.esOrigPost ' + videoMp4Onebox);
  });

  // Let's do the remaining tests as a non-staff member.
  it("Owen leaves; Maria logs in", async () => {
    await owensBrowser.topbar.clickLogout();
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.disableRateLimits();
  });

  it("She can also post image urls, which get converted to preview <img> tags", async () => {
    const nr = c.FirstReplyNr;
    await mariasBrowser.complex.replyToOrigPost(imageJpgUrl);
    await mariasBrowser.topic.waitUntilPostHtmlMatches(nr, /\.jpg/);
    await mariasBrowser.topic.assertPostNrContains(nr, dotOneboxClass);
    await mariasBrowser.topic.assertPostNrContains(nr, imageJpgOnebox);
  });

  it(`Links get changed to https: if the server uses https:
       — but http: outside any links, is left as is`, async () => {
    const nr = 3;
    assert.eq(nr, c.FirstReplyNr + 1);
    await mariasBrowser.complex.replyToOrigPost(httpButNotALinkSource);
    await mariasBrowser.topic.waitUntilPostHtmlMatches(nr, /Don't change http/);
    const postHtml = await mariasBrowser.topic.getPostHtml(nr);
    httpButNotALinkRegexs.forEach(substrWithHttp => {
      assert.includes(postHtml, substrWithHttp);
    });
    // This was a real link:
    await mariasBrowser.topic.assertPostNrContains(nr, imageJpgOnebox);
    assert.includes(postHtml, settings.secure ? httpsImageJpgUrl : httpImageJpgUrl);
    assert.excludes(postHtml, settings.secure ? httpImageJpgUrl : httpsImageJpgUrl);
  });

  it("But unknown links won't get converted to oneboxes", async () => {
    const nr = 4;
    const weirdUrl = 'https://www.example.com/what.is.this.weirdweird';
    await mariasBrowser.complex.replyToOrigPost(weirdUrl);
    await mariasBrowser.topic.waitUntilPostTextMatches(nr, 'weirdweird');
    await mariasBrowser.topic.assertPostNrNotContains(nr, dotOneboxClass);
    await mariasBrowser.topic.assertPostNrContains(nr, `a[href="${weirdUrl}"]`);
  });

  it("A media url inside a text paragraph is converted to a plain link", async () => {
    const nr = 5;
    await mariasBrowser.complex.replyToOrigPost('zzz ' + imageJpgUrl + ' qqq');
    await mariasBrowser.topic.waitUntilPostTextMatches(nr, 'zzz .* qqq');
    await mariasBrowser.topic.assertPostNrNotContains(nr, dotOneboxClass);
    await mariasBrowser.topic.assertPostNrContains(nr, `a[href="${imageJpgUrl}"]`);
  });

  it("A link preview can be inserted between two text paragraphs", async () => {
    const nr = 6;
    await mariasBrowser.complex.replyToOrigPost("Paragraph one.\n\n" + imageJpgUrl + "\n\nPara two.");
    await mariasBrowser.topic.waitUntilPostTextMatches(nr, "Paragraph one");
    await mariasBrowser.topic.assertPostTextMatches(nr, "Para two");
    // Failed once.
    await mariasBrowser.topic.assertPostNrContains(nr, dotOneboxClass);
    await mariasBrowser.topic.assertPostNrContains(nr, imageJpgOnebox);
  });

  const nr7 = 7;

  it("Jpg, png, gif, mp4 link previews work fine", async () => {
    const nr = nr7;
    // This happens to be 5 x 2 links, = 10, < max which is 11 [TyT603RTDJ43].
    // (Each link preview has a widget link, and also a "View at ..." clickable link.)
    await mariasBrowser.complex.replyToOrigPost(
        httpImageJpgUrl + '\n\n' + // <— should get changed to https -.
        imagePngUrl + '\n\n' +     //                                  |
        imageGifUrl + '\n\n' +     //                                  |
        videoMp4Url + '\n\n' +     //                                  |
        videoYouTubeUrl);          //                                  |
    await mariasBrowser.topic.waitUntilPostHtmlMatches(nr, /\.jpg/);    //   |
    await mariasBrowser.topic.assertPostNrContains(nr, dotOneboxClass); //   |
    await mariasBrowser.topic.assertPostNrContains(nr, imageJpgOnebox); // <-'  here
    await mariasBrowser.topic.assertPostNrContains(nr, imagePngOnebox);
    await mariasBrowser.topic.assertPostNrContains(nr, imageGifOnebox);
    await mariasBrowser.topic.assertPostNrContains(nr, videoMp4Onebox);
  });

  it("... and YouTube links too", async () => {
    await mariasBrowser.topic.assertPostNrContains(nr7, videoYouTubeOnebox);
  });

  it("The server survives an invalid YouTube video id", async () => {
    const nr = 8;
    // Reply to the previous post because we've now scrolled down so the orig post isn't visible.
    await mariasBrowser.complex.replyToPostNr(6, videoYouTubeUrlInvalidId + '\n\n\nPlain text.');
    await mariasBrowser.topic.waitUntilPostTextMatches(nr, "Plain text");
    await mariasBrowser.topic.assertPostNrContains(nr, '.s_LnPv-Err');
    await mariasBrowser.topic.assertPostNrContains(nr, `a[href="${videoYouTubeUrlInvalidId}"]`);
    await mariasBrowser.topic.assertPostTextMatches(nr, 'TyEYOUTBID_');
  });

});

