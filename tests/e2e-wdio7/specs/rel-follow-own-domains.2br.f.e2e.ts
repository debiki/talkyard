/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let guest_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;


enum Links {
  en_wikipedia_org = 'https://en.wikipedia.org',
  en_wikipedia_org_wiki_Main_Page = 'https://en.wikipedia.org/wiki/Main_Page',
  sv_wikipedia_org_wiki_Portal_Huvudsida = 'https://sv.wikipedia.org/wiki/Portal:Huvudsida',
  news_ycombinator_com = 'https://news.ycombinator.com',
  github_com = 'https://github.com',
  github_com_debiki_talkyard = 'https://github.com/debiki/talkyard',
  pages_github_com_ = 'https://pages.github.com/',
  http_pages_github_com_ = 'http://pages.github.com/',
  www_example_com = 'https://www.example.com',
} // And also:  site.origin + '/internal_forum_link';   [_int_link]   TESTS_MISSING

let lotsOfLinks = '\n' +
  Links.en_wikipedia_org + '\n' +
  Links.en_wikipedia_org_wiki_Main_Page + '\n' +
  Links.sv_wikipedia_org_wiki_Portal_Huvudsida + '\n' +
  Links.news_ycombinator_com + '\n' +
  Links.github_com + '\n' +
  Links.github_com_debiki_talkyard + '\n' +
  Links.pages_github_com_ + '\n' +
  Links.http_pages_github_com_ + '\n' +
  Links.www_example_com + '\n' +
  ''; // And also:   site.origin + '/internal_forum_link';

const followNothing = theAnswer([
  [-1, Links.en_wikipedia_org],
  [-1, Links.en_wikipedia_org_wiki_Main_Page],
  [-1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
  [-1, Links.news_ycombinator_com],
  [-1, Links.github_com],
  [-1, Links.github_com_debiki_talkyard],
  [-1, Links.pages_github_com_],
  [-1, Links.http_pages_github_com_],
  [-1, Links.www_example_com],
  ]);

function theAnswer(shallFollow: [Nr, St][]): St {
  const lines = shallFollow.map((shallAndLink: [Nr, St]) => {
    const shallFollow = shallAndLink[0];
    const link = shallAndLink[1];
    const anyRel = shallFollow === -1 ? ' rel="nofollow"' : '';
    return `<a href="${link}"${anyRel}>${link}</a>`;
  });
  const text = '<p>' + lines.join('<br>\n') + '</p>';
  return text;
}


describe(`rel-follow-own-domains.2br.f  TyTFOLLOWLNS  TyTRELNOFLW01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Follow Links to Own Domains",
      members: ['maria', 'michael']
    });

    // Enable guests.
    // Disable notifications, not needed in this test.
    builder.settings({
      requireVerifiedEmail: false,
      allowGuestLogin: true,
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    maria = forum.members.maria;
    maria_brB = brB;
    guest_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);

    //lotsOfLinks += site.origin + '/internal_forum_link\n';   [_int_link]
  });


  it(`Owen logs in, goes to the site settings`, async () => {
    await owen_brA.adminArea.settings.advanced.goHere(site.origin, { loginAs: owen });
  });

  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- Nofollow, by default

  it(`Maria posts a page`, async () => {
    await maria_brB.complex.createAndSaveTopic({ title: "Links_Page_Title", body: lotsOfLinks,
            // The resulting html will include html markup: <a href=...>,
            // so won't match the submitted source text.
            matchAfter: false });
  });

  it(`... all external links become rel=nofollow`, async () => {
    const html = await maria_brB.topic.getPostHtml(c.BodyNr);
    assert.includes(html, followNothing);
  });


  // ----- Rel-follow own domains

  it(`Owen configures own domains:  en.wikipedia.org`, async () => {
    await owen_brA.adminArea.settings.advanced.setOwnDomains('en.wikipedia.org');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  let replyNr = -1;

  it(`Maria posts a comment`, async () => {
    await maria_brB.complex.replyToOrigPost(lotsOfLinks);
    replyNr = c.FirstReplyNr;
  });

  it(`Links to own domains are *not* nofollow, only external links`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(replyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],                 //  <—— +1
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],  //  <——
            [-1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],  // wrong subdomain
            [-1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [-1, Links.pages_github_com_],
            [-1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- Subdomains

  it(`Owen hacks and claims all of Wikipedia:  wikipedia.org`, async () => {
    await owen_brA.adminArea.settings.advanced.setOwnDomains(
      'en.wikipedia.org\n' +
      'wikipedia.org');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Maria posts another comment`, async () => {
    await maria_brB.complex.replyToOrigPost(lotsOfLinks);
    replyNr += 1;
  });

  it(`Links to own subdomains are *not* nofollow`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(replyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [ 1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],  // <—— now our subdomain
            [-1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [-1, Links.pages_github_com_],
            [-1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- 3rd party rel-follow domains

  it(`Owen likes GitHub Pages, removes rel=nofollow for GitHub links`, async () => {
    await owen_brA.adminArea.settings.advanced.setExternalDomains('pages.github.com');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Maria posts another comment`, async () => {
    await maria_brB.complex.replyToOrigPost(lotsOfLinks);
    replyNr += 1;
  });

  it(`Links to re-follow external subdomains are *not* nofollow`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(replyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [ 1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
            [-1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [ 1, Links.pages_github_com_],       //  <——
            [ 1, Links.http_pages_github_com_],  //  <——
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- 3rd party subdomains

  it(`Owen likes all of GitHub actually, and he likes HackerNews too`, async () => {
    await owen_brA.adminArea.settings.advanced.setExternalDomains(
        'github.com\n' +
        'news.ycombinator.com\n' +
        '');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Maria posts another comment`, async () => {
    await maria_brB.complex.replyToOrigPost(lotsOfLinks);
    replyNr += 1;
  });

  it(`Links trusted subdomains are *not* nofollow`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(replyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [ 1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
            [ 1, Links.news_ycombinator_com],        //  <——
            [ 1, Links.github_com],                  //  <——
            [ 1, Links.github_com_debiki_talkyard],  //  <——
            [ 1, Links.pages_github_com_],
            [ 1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- Remove domains

  it(`Owen removes GitHub and Wikipedia`, async () => {
    await owen_brA.adminArea.settings.advanced.setExternalDomains(
            'news.ycombinator.com');
    await owen_brA.adminArea.settings.advanced.setOwnDomains(
            'en.wikipedia.org');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Maria posts another comment`, async () => {
    await maria_brB.complex.replyToOrigPost(lotsOfLinks);
    replyNr += 1;
  });

  it(`Now only links to en.wikipedia.org and HackerNews are followed`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(replyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [-1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
            [ 1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [-1, Links.pages_github_com_],
            [-1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- Guests

  it(`A guest arrives, Maria leaves`, async () => {
    await maria_brB.topbar.clickLogout();
    await guest_brB.go2('/');
    await guest_brB.topbar.clickSignUp();
    await guest_brB.loginDialog.switchToJoinAsGuest();
    await guest_brB.loginDialog.signUpLogInAs_Real_Guest('GustavGuest', '');
    await guest_brB.loginDialog.waitForAndCloseWelcomeLoggedInDialog();
  });

  let guestsPageUrl = '';

  it(`... posts a page with links`, async () => {
    await guest_brB.complex.createAndSaveTopic({ title: 'Guest Page', body: lotsOfLinks,
            matchAfter: false });
    guestsPageUrl = await guest_brB.urlPath();
  });

  it(`Links become follow/nofollow in the same way, for guests`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(c.BodyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [-1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
            [ 1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [-1, Links.pages_github_com_],
            [-1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- Staff

  it(`Owen also posts links`, async () => {
    await owen_brA.go2(guestsPageUrl);
    await owen_brA.complex.replyToOrigPost(lotsOfLinks);
  });

  it(`Links become follow/nofollow in the same way, for admins`, async () => {
    const actualHtml = await owen_brA.topic.getPostHtml(c.FirstReplyNr);
    const expectedHtml = theAnswer([
            [ 1, Links.en_wikipedia_org],
            [ 1, Links.en_wikipedia_org_wiki_Main_Page],
            [-1, Links.sv_wikipedia_org_wiki_Portal_Huvudsida],
            [ 1, Links.news_ycombinator_com],
            [-1, Links.github_com],
            [-1, Links.github_com_debiki_talkyard],
            [-1, Links.pages_github_com_],
            [-1, Links.http_pages_github_com_],
            [-1, Links.www_example_com],
            ]);
    assert.includes(actualHtml, expectedHtml);
  });


  // ----- Remove all domains

  it(`Owen clears the own and external domain settings`, async () => {
    await owen_brA.adminArea.settings.advanced.goHere('');
    await owen_brA.adminArea.settings.advanced.setExternalDomains('');
    await owen_brA.adminArea.settings.advanced.setOwnDomains('');
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`The guests posts the links again`, async () => {
    await guest_brB.refresh2();
    await guest_brB.complex.replyToOrigPost(lotsOfLinks);
  });

  it(`All non-internal links become nofollow`, async () => {
    const actualHtml = await maria_brB.topic.getPostHtml(c.SecondReplyNr);
    assert.includes(actualHtml, followNothing);
  });


});

