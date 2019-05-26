/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let forumTitle = "UTX All Logins Test Forum";


const utxImpl = {

  goToHomepage: function(browser, idAddress) {
    browser.go(idAddress.origin + '/homepage');
  },

  goToSubmitPage: function(browser, idAddress) {
    browser.go(idAddress.origin + '/submit-site');
  },

  goToQueue: function(browser, idAddress) {
    browser.go(idAddress.origin + '/latest/queue');
  },

  typeAddressSubmit: function(browser, address) {
    browser.waitForVisible('#utxWebsiteAddr');
    browser.waitForEnabled('#utxWebsiteAddr');
    browser.setValue('#utxWebsiteAddr', address);
    browser.rememberCurrentUrl();
    browser.waitAndClick('.utxContinueBtn');
    browser.waitForNewUrl();
  },

  typeInstructionsSubmit: function(browser, address?, instructions?) {
    // Wait for the address input to get updated to the value in the url, by some js.
    // Should loop and read & check the value —> test more stable. But just .pause(..) works ok.
    browser.pause(1000);
    if (address) {
      browser.setValue('#utxAskForUx_Address', address)
    }
    if (instructions) {
      browser.setValue('#utxAskForUx_Instrs', instructions);
    }
    browser.waitAndClick('.utxActionBtns input[type="submit"]')
  },

  checkIsThanksPageContinue: function(browser) {
    browser.waitForVisible('.e_UtxThanks');
    browser.rememberCurrentUrl();
    browser.waitAndClick('.utxContinueBtn');
    browser.waitForNewUrl();
  },

  pickATask: function(browser) {
    browser.waitForVisible('.e_UtxGiveMeATask');
    browser.rememberCurrentUrl();
    browser.waitAndClick('.ShowIfLoggedIn .utxContinueBtn');
    browser.waitForNewUrl();
  },

  checkIsNoMoreTasksPage: function(browser) {
    browser.waitForVisible('.e_UtxNothingMoreToDo');
  },

  skipTask: function(browser) {
    browser.rememberCurrentUrl();
    browser.waitAndClick('.s_UtxHelp_HaveAsked_ContinueB-skip');
    browser.waitForNewUrl();
  },

  continueWithNextTaskAfterHavingSubmittedFeedback: function(browser) {
    // Don't know why but the button is broken for a while, does nothing. So wait. [E2EBUG]
    // Could click sooner and add a loop and try again? Or what? But just pause(..) works ok.
    browser.pause(1000);
    browser.rememberCurrentUrl();
    browser.waitAndClick('.dw-res .s_UtxHelp_HaveAsked_ContinueB');
    browser.waitForNewUrl();
  },

  // Copied from UTX on 2017-12-19
  javascript: `
debiki.scriptLoad.done(function() {

Bliss.delegate(document.body, 'click', '#utxSubmitAddrForm input[type="submit"]', function(event) {
  event.preventDefault();
  event.stopPropagation();
  var addrInp = document.getElementById('utxWebsiteAddr');
  var websiteUrl = addrInp.value;
  location.assign('/submit-site?websiteUrl=' + websiteUrl);
});

var addrInp = document.getElementById('utxAskForUx_Address');
if (addrInp) {
  var matches = location.search.match(/websiteUrl=([^?#]+)/);
  if (matches) {
    var v = matches[1];
    if (!v.match(/^ *https?:\\/\\/.*$/)) {
      v = 'http://' + v;  // hopefully redirs to https. Dupl code, see below.
    }
    addrInp.value = v;
  }
  addrInp.addEventListener('blur', function() {
    if (!addrInp.value.match(/^ *https?:\\/\\/.*$/)) {
      addrInp.value = 'http://' + addrInp.value;  // hopefully redirs to https. Dupl code, see above.
    }
  });
}

function initShareBtn(provider) {
  var btn = document.querySelector('.utxHomepage .icon-' + provider);
  if (btn) {
    btn.addEventListener('click', function(event) {
      debiki2.pagedialogs.openSharePopup("https://usability.testing.exchange", provider, {
        title: "Usability Testing Exchange", summary: "Get feedback about your website / app, so you can improve it. We'll have someone try it out (usability testing) for you" });
    });
  }
}
initShareBtn('facebook');
initShareBtn('twitter');
initShareBtn('google');
initShareBtn('linkedin');

});`,

  // Copied from UTX on 2017-12-19
  homepageHtml: `
<h1>Get feedback about your website/app</h1>
<h2 class="utxGetAVideo">Find out why some people leave</h2>
<!-- The more you give to others, the more you'll get yourself -->

<div class="utxActionBtns">
<label for="utxWebsiteAddr">Type  your website/app address: &nbsp;(it's free)</label>
<form id="utxSubmitAddrForm">
<input id="utxWebsiteAddr" placeholder="https://www.example.com"></input>
<input class="btn utxContinueBtn" type="submit" value="Get feedback ..."></input>
</form>
`,

  // Copied from UTX on 2017-12-19
  submitSitePageHtml: `
<div class="utxInstructions utxSubmitPage">

Here you can give instructions to the people who will give you feedback.
<br>

<form id="utxSignUpSubmitForm">
<input type="hidden" name="doWhat" value="SignUpSubmitUtx">
<input type="hidden" name="nextUrl" value="/after-submitted-own-site">
<input type="hidden" name="pageTypeId" value="21">
<input type="hidden" name="categorySlug" value="queue">
<div class="utxBodyStuff">
<label for="utxAskForUx_Address">Address of website/app to test:</label><br>
<input type="url" name="websiteAddress" id="utxAskForUx_Address" placeholder="https://www.example.com" required>
</div>
<div class="utxBodyStuff">
<label for="utxAskForUx_Instrs">Instructions and questions to the tester:</label>
<textarea name="instructionsToTester" id="utxAskForUx_Instrs" required>
Look at the website for 10 - 20 seconds. What do you think it is about?
What does the website make you want to do? Start doing that, and describe your experience.
Is there anything that makes you feel frustrated or confused? Or that you like?
Any other thoughts or feedback?
For e2e tests: 4GKR02QX
</textarea>
</div>
<div class="utxActionBtns">
<input type="submit" class="btn utxContinueBtn" value="Submit">
</div>
</form>
</div>
`,

  // Copied from UTX on 2017-12-19
  afterSubmittedOwnSitePageHtml: `
<div class="utxInstructions utxSubmitPage e_UtxThanks">

<p>You'll be notified via email, when someone has tested your website / app.</p>

<p>Now, time for you to do usability testing, for other people.</p>

<div class="utxActionBtns">
<a class="btn utxContinueBtn" href="/give-me-a-task">Continue ...</a>
</div>

</div>
`,

  // Copied from UTX on 2017-12-19
  giveMeATaskPageHtml: `
<div class="utxInstructions utxSubmitPage e_UtxGiveMeATask">
<ul>
<li>The more websites/apps you test and give feedback about, the more feedback you'll get, about your own stuff.</li>
<li>Answer the questions as best you can (rather than just writing things like "nice colors" and nothing else) — then you'll get more feedback.</li>
<li>You can come back here later, click "Help others ..." in the upper right corner, and continue testing and giving feedback to others. Then you'll get more feedback yourself.
<ul>

<!-- br>
<p>Testing a website/app takes about 15 minutes:</p>
<ul>
<li>Perhaps 5 minutes for testing the website.
<li>Another  5 minutes for writing down answers to the questions you'll get.</li>
<li>Later, [the person whose website you tested] might ask you follow up questions. If you want to answer them, great :- )&nbsp; Might take another 5 minutes.</li>
</ul -->

<form class="ShowIfNotLoggedIn">
<input type="hidden" name="doWhat" value="SignUp">
<div class="utxActionBtns">
<input type="submit" class="btn utxContinueBtn" value="First, sign up / log in...">
</div>
</form>

<div class="utxActionBtns ShowIfLoggedIn">
<a class="btn utxContinueBtn" href="/-/utx-pick-a-task?categorySlug=queue">Ok, give me a task ...</a>
</div>

</div>
`,

  nothingMoreToDoPageHtml: `
<div class="utxInstructions utxSubmitPage e_UtxNothingMoreToDo">

You have tested all websites/apps. If you skipped some of them, you can click **Restart** and have look at them again. Or click **View Test Queue** to see a list of all open tasks.

<div class="utxActionBtns">
<a class="btn utxContinueBtn e_utxRestart" href="/give-me-a-task">Restart</a>
<a class="btn utxContinueBtn" href="/forum/latest/queue">View Test Queue</a>
</div>
</div>
`,

};

export = utxImpl;
