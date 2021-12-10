/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';


let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`editor-toolbar-preview.1br  TyTEEDTOOLBTNS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: [], // just Owen
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');

    owen = forum.members.owen;
    owen_brA = brA;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Owen starts typing a new topic`, async () => {
    await owen_brA.forumButtons.clickCreateTopic();
  });

  let expectedText = '';


  // ----- Inline text

  it(`... inserts bold text`, async () => {
    await owen_brA.waitForThenClickText('.esEdtr_txtBtn', 'B');
  });
  it(`... bold text appears`, async () => {
    const text = await owen_brA.editor.getText();
    expectedText += "**bold text**";
    assert.eqManyLines(text, expectedText);
  });

  it(`inserts italic text`, async () => {
    await owen_brA.waitForThenClickText('.esEdtr_txtBtn', 'I');
  });
  it(`... italic text appears`, async () => {
    const text = await owen_brA.editor.getText();
    expectedText += "*emphasized text*";
    assert.eqManyLines(text, expectedText);
  });


  // ----- The preview works

  it(`... the preview shows the bold and itlaic text`, async () => {
    await owen_brA.preview.waitUntilPreviewHtmlMatches(
            `<p><strong>bold text</strong><em>emphasized text</em></p>`,
            { where: 'InEditor' });
  });


  // ----- Text blocks

  it(`inserts a quote`, async () => {
    await owen_brA.waitForThenClickText('.esEdtr_txtBtn', '"');
  });
  it(`... a quote appears`, async () => {
    const text = await owen_brA.editor.getText();
    expectedText += "\n\n> quoted text\n\n";
    assert.eqManyLines(text, expectedText);
  });

  it(`... types a char, so we'll notice any missing \\n\\n`, async () => {
    await owen_brA.editor.typeChar('x', { append: true });
  });

  it(`inserts a code block`, async () => {
    await owen_brA.waitAndClick('.esEdtr_txtBtns .icon-code');
  });
  it(`... a code block appears`, async () => {
    const text = await owen_brA.editor.getText();
    expectedText += "x\n\n```\npreformatted text\n```\n\n";
    assert.eqManyLines(text, expectedText);
  });

  it(`inserts a heading`, async () => {
    await owen_brA.editor.typeChar('x', { append: true });
    await owen_brA.waitForThenClickText('.esEdtr_txtBtn', 'H');
  });
  it(`... a heading appears`, async () => {
    const text = await owen_brA.editor.getText();
    expectedText += "x\n\n### Heading\n\n";
    assert.eqManyLines(text, expectedText);
  });


  // ----- No unnecessary newlines  [ed_toolbr_2_newl]

  it(`Won't add unnecessary newlines, when adding \\n\\n....\\n\\n blocks`, async () => {
    await owen_brA.editor.moveCursorToEnd(); // why needed here, not above??
    await owen_brA.waitAndClick('.esEdtr_txtBtns .icon-code');
  });
  it(`... a code block but no additional leading \\n appears`, async () => {
    const text = await owen_brA.editor.getText();
    // No newlines ——v            only after ———v
    expectedText += "```\npreformatted text\n```\n\n";
    assert.eqManyLines(text, expectedText);
  });

  it(`Owen types a char and a single newline`, async () => {
    await owen_brA.editor.typeChar('x', { append: true });
    await owen_brA.editor.typeChar('\n', { append: true });
    expectedText += "x\n";
    const text = await owen_brA.editor.getText();
    assert.eqManyLines(text, expectedText);
  });

  it(`... adds a code block, after a single newline`, async () => {
    await owen_brA.waitAndClick('.esEdtr_txtBtns .icon-code');
  });
  it(`... a code block and *one* extra initial '\\n' appears`, async () => {
    const text = await owen_brA.editor.getText();
    // Now one ——————v  newline, so two in total (see [ed_toolbr_2_newl]).
    expectedText += "\n```\npreformatted text\n```\n\n";
    assert.eqManyLines(text, expectedText);
  });


  // ----- Foramtting selected inline text

  // TESTS_MISSING


  // ----- Foramtting selected text blocks, & preview

  it(`Owen types some code, selects it, formats as code`, async () => {
    const computerProgram =
            `import world from 'world';\n` +
            `\n` +
            `world.say("Hello human");\n`;
    await owen_brA.editor.editText(computerProgram);
    await owen_brA.editor.selectAllText();
    await owen_brA.waitAndClick('.esEdtr_txtBtns .icon-code');
    const text = await owen_brA.editor.getText();
    assert.eqManyLines(text, '```\n' + computerProgram + '\n```\n\n');
  });

  it(`... the preview works, for code blocks`, async () => {
    await owen_brA.preview.waitUntilPreviewHtmlIncludes(
            `<pre><code>import world from 'world';\n` +
            `\n` +
            `world.say("Hello human");\n` +
            `\n` +
            `</code></pre>`,
            { where: 'InEditor' });
  });

  it(`Owen writes a famous quote, selects it, formats as a quote`, async () => {
    const famousQuote =
            `To be or not to be\n` +
            `\n` +
            `That is the question, what is the answer?\n` +
            `The answer is, I'll tell you later`;
    await owen_brA.editor.editText(famousQuote);
    await owen_brA.editor.selectAllText();
    await owen_brA.waitForThenClickText('.esEdtr_txtBtn', '"');
    const text = await owen_brA.editor.getText();
    assert.eqManyLines(text,
`> To be or not to be
> 
> That is the question, what is the answer?
> The answer is, I'll tell you later

`);
  });

  it(`... the preview works, for quotes too`, async () => {
    await owen_brA.preview.waitUntilPreviewHtmlMatches(
            `<blockquote>\n` +
            `<p>To be or not to be</p>\n` +
            `<p>That is the question, what is the answer\\?<br>\n` +
            `The answer is, I'll tell you later</p>\n` +
            `</blockquote>`,
            { where: 'InEditor' });
  });

});
