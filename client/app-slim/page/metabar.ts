/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// <reference path="../ReactStore.ts" />
/// <reference path="../react-elements/name-login-btns.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../notification/notf-prefs-button.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../oop-methods.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


/**
 * Shows meta information about the page: created by, when, num replies,
 * message members (if is a private message page), summarize replies button, etc.
 *
 * RENAME to Pagebar?  "Meta" is too unspecific?  or PageMetaBar?  [metabar_2_pagebar]
 */
export var Metabar = createComponent({
  displayName: 'Metabar',

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      ui: { showDetails: false },
      numRepliesSummarized: null,
    };
  },

  componentDidMount: function() {
    debiki2.ReactStore.addChangeListener(this.onChange);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    debiki2.ReactStore.removeChangeListener(this.onChange);
  },

  onChange: function() {
    if (this.isGone) return;
    this.setState({
      store: debiki2.ReactStore.allData(),
      ui: this.state.ui
    });
  },

  onReplyClick: function() {
    die('unimpl [EdE2QKT0]');  // was: d.i.showReplyFormEmbeddedComments(); [todo-emb-cmts]
  },

  onToggleDetailsClick: function() {
    this.state.ui.showDetails = !this.state.ui.showDetails;
    this.setState(this.state);
  },

  summarizeReplies: function() {
    ReactActions.summarizeReplies();
    setTimeout(() => {
      this.setState({
        numRepliesVisible: $$all('.dw-p').length,
        numRepliesSummarized: $$all('.dw-p.dw-x').length
      });
    }, 1);
  },

  render: function() {
    const store: Store = this.state.store;
    const page: Page = store.currentPage;
    const ui = this.state.ui;
    const me: Myself = store.me;
    const isBlogComments = page.pageRole === PageRole.EmbeddedComments;

    let notfLevelElem: RElm | Nl = null;
    if (me.isAuthenticated && !ui.showDetails) {
      const effPref = pageNotfPrefTarget_findEffPref({ pageId: page.pageId }, store, me);
      const level = notfPref_level(effPref);
      notfLevelElem = r.span({ className: `dw-page-notf-level n_NfLv-${level}`,
              onClick: this.onToggleDetailsClick },
          t.Notifications + ': ' + notfPref_title(effPref));
    }

    const toggleDetailsBtn = !me.isLoggedIn ? null :
        r.button({ className: 'dw-cmts-tlbr-open', onClick: this.onToggleDetailsClick },
          r.span({ className: (ui.showDetails ? 'icon-up-open' : 'icon-down-open') }));

    // If not in emb cmts, then login btns in topbar, need not show here too.
    const nameLoginBtns = !isBlogComments ? null :
        r.li({}, reactelements.NameLoginBtns({}));

    const summaryElem =
      r.div({ className: 'dw-cmts-tlbr-head' },
          r.ul({ className: 'dw-cmts-tlbr-summary' },
              r.li({ className: 'dw-cmts-count' },
                page.numRepliesVisible + ' ' + (
                    isBlogComments ? (t.comments || t.replies) : t.replies)),  // I18N t.comments missing
              nameLoginBtns,
              r.li({}, notfLevelElem)),
          toggleDetailsBtn);

    const detailsElem = ui.showDetails
      ? MetabarDetails({ store: store })
      : null;

    let anyExtraMeta;
    if (page.pageRole === PageRole.FormalMessage) {
      const members = store_getPageMembersList(store);
      const memberList = members.map((user) => {
        return (
            r.div({ className: 'esMetabar_msgMmbr', key: user.id },
              avatar.Avatar({ user: user, origins: store }),
              r.span({ className: 'esMetabar_msgMmbr_username' }, user.username)));
      });
      anyExtraMeta =
          r.div({ className: 'esMetabar_extra' },
            r.div({ className: 'icon-mail' }, t.mb.Msg),
            r.div({ className: 'esMetabar_msgMmbrs' },
              memberList));
    }

    // ----- Summarize replies section

    let summarizeStuff;
    if (page.numRepliesVisible >= 10) {
      const doneSummarizing = !_.isNumber(this.state.numRepliesSummarized) ? null :
          r.span({ style: { marginLeft: '1em' }},
          // Only visiblie replies are summarized, so the count might be confusingly low,
          // if we don't clarify that only visible replies get summarized.
          t.mb.DoneSummarizing(this.state.numRepliesSummarized, this.state.numRepliesVisible));
      const minutes = estimateReadingTimeMinutesSkipOrigPost(<Post[]> _.values(page.postsByNr));
      if (minutes >= 10 || page.numRepliesVisible >= 20) {
        summarizeStuff =
          r.div({ className: 'esMetabar_summarize' },
            r.p({}, t.mb.EstTime(page.numRepliesVisible, Math.ceil(minutes))),
            Button({ onClick: this.summarizeReplies }, t.mb.SmrzRepls), doneSummarizing);
      }
    }

    // ----- Put everything together

    return (
        r.div({ className: 'dw-cmts-tlbr esMetabar', id: 'dw-cmts-tlbr' },
          summaryElem,
          detailsElem,
          anyExtraMeta,
          summarizeStuff));
  }
});


const MetabarDetails = createComponent({
  displayName: 'MetabarDetails',

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const userAuthenticated = me && me.isAuthenticated;

    const notificationsElem = !userAuthenticated ? null :
      r.div({},
        r.div({ className: 'esMB_Dtls_Ntfs_Lbl' }, t.mb.NotfsAbtThisC),
        notfs.PageNotfPrefButton({ target: { pageId: store.currentPageId }, store, ownPrefs: me }));

    return (
      r.div({ className: 'dw-cmts-tlbr-details' },
          notificationsElem));
  }
});



function estimateReadingTimeMinutesSkipOrigPost(posts: Post[]): number {
  // People read 200 English words per minute, with 60% reading comprehension.
  // But 60% is rather low. Let's improve that, and assume a few distractions –> 120? wpm instead.
  const wordsPerMinute = 120;
  // Google "average word length" –> "English, French, Spanish and German are approximately
  // 5.10, 5.13, 5.22 and 6.26" (www.puchu.net/doc/Average_Word_Length),
  // Russian: 5.3 (http://arxiv.org/pdf/1208.6109.pdf)
  //    — so let's use 5.2.
  // But what about Chinese and Japanese?
  const averageWordLength = 5.2;
  // % html chars varies between 60% and 95% ? fairly much depending on how many <a href=...>
  // there are in comparison to the amount of visible text.
  const removeHtml = 0.8; // guessing that 20% chars is html tags and classes and href=...
  const numChars = _.sumBy(posts, (post: Post) => {
    // Exclude the original post.
    if (post.nr === BodyNr || post.nr === TitleNr) return 0;
    return post.sanitizedHtml ? post.sanitizedHtml.length : 0
  });
  const numWords = numChars * removeHtml / averageWordLength;
  return numWords / wordsPerMinute;
}

// Don't use, only for testing.
export var debugEstimateReadingTime = estimateReadingTimeMinutesSkipOrigPost;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
