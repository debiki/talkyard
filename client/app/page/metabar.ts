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
/// <reference path="../widgets.ts" />
/// <reference path="../oop-methods.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let notfsLevelDropdownModal;

export function openNotfsLevelDropdown(openButton, subject: NotfSubject, currentLevel: NotfLevel) {
  if (!notfsLevelDropdownModal) {
    notfsLevelDropdownModal = ReactDOM.render(NotfsLevelDropdownModal(), utils.makeMountNode());
  }
  notfsLevelDropdownModal.openAtForSubject(openButton, subject, currentLevel);
}


/**
 * Shows meta information about the page: created by, when, num replies,
 * message members (if is a private message page), summarize replies button, etc.
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
    const myPageData: MyPageData = me.myCurrentPageData;

    const notfLevelElem = me.isAuthenticated && !ui.showDetails
      ? r.span({ className: 'dw-page-notf-level', onClick: this.onToggleDetailsClick },
          'Notifications: ' + notfLevel_title(myPageData.rolePageSettings.notfLevel))
      : null;

    const toggleDetailsBtn = !me.isLoggedIn ? null :
        r.button({ className: 'dw-cmts-tlbr-open', onClick: this.onToggleDetailsClick },
          r.span({ className: (ui.showDetails ? 'icon-up-open' : 'icon-down-open') }));

    // If not in emb cmts, then login btns in topbar, need not show here too.
    const nameLoginBtns = page.pageRole !== PageRole.EmbeddedComments ? null :
        r.li({}, reactelements.NameLoginBtns({}));

    const summaryElem =
      r.div({ className: 'dw-cmts-tlbr-head' },
          r.ul({ className: 'dw-cmts-tlbr-summary' },
              r.li({ className: 'dw-cmts-count' }, page.numPostsRepliesSection + " replies"),
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
              avatar.Avatar({ user: user }),
              r.span({ className: 'esMetabar_msgMmbr_username' }, user.username)));
      });
      anyExtraMeta =
          r.div({ className: 'esMetabar_extra' },
            r.div({ className: 'icon-mail' }, "Message"),
            r.div({ className: 'esMetabar_msgMmbrs' },
              memberList));
    }

    // ----- Summarize replies section

    let summarizeStuff;
    if (page.numPostsRepliesSection >= 10) {
      const doneSummarizing = !_.isNumber(this.state.numRepliesSummarized) ? null :
          r.span({ style: { marginLeft: '1em' }},
          // Only visiblie replies are summarized, so the count might be confusingly low,
          // if we don't clarify that only visible replies get summarized.
          `Done. Summarized ${this.state.numRepliesSummarized} replies, ` +
            `of the ${this.state.numRepliesVisible} replies previously shown.`);
      const minutes = estimateReadingTimeMinutesSkipOrigPost(<Post[]> _.values(page.postsByNr));
      if (minutes >= 10 || page.numPostsRepliesSection >= 20) {
        summarizeStuff =
          r.div({ className: 'esMetabar_summarize' },
            r.p({}, "There are " + page.numPostsRepliesSection + " replies. " +
              "Estimated reading time: " + Math.ceil(minutes) + " minutes"),
            Button({ onClick: this.summarizeReplies }, "Summarize Replies"), doneSummarizing);
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
    const myPageData: MyPageData = me.myCurrentPageData;
    const userAuthenticated = me && me.isAuthenticated;
    const notfLevel: NotfLevel = myPageData.rolePageSettings.notfLevel;

    const notificationsElem = !userAuthenticated ? null :
      r.div({},
        r.div({ className: 'esMB_Dtls_Ntfs_Lbl' }, "Notifications about this topic:"),
        Button({ id: '7bw3gz5', className: 'dw-notf-level', onClick: event => {
              openNotfsLevelDropdown(event.target, { pageId: store.currentPageId }, notfLevel)
            }},
          r.span({}, notfLevel_title(notfLevel) + ' ', r.span({ className: 'caret' }))));

    return (
      r.div({ className: 'dw-cmts-tlbr-details' },
          notificationsElem));
  }
});


// some dupl code [6KUW24]
const NotfsLevelDropdownModal = createComponent({
  displayName: 'NotfsLevelDropdownModal',

  mixins: [StoreListenerMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData() });
  },

  // dupl code [6KUW24]
  openAtForSubject: function(at, subject: NotfSubject, currentLevel: NotfLevel) {
    const rect = at.getBoundingClientRect();
    this.setState({
      isOpen: true,
      atX: rect.left,
      atY: rect.bottom,
      subject: subject,
      currentLevel: currentLevel,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  setNotfLevel: function(newLevel) {
    const subject: NotfSubject = this.state.subject;
    if (subject.pageId) {
      ReactActions.setPageNoftLevel(newLevel);
    }
    else if (subject.tagLabel) {
      Server.setTagNotfLevel(subject.tagLabel, newLevel);
    }
    else {
      die('EsE4KG8F2');
    }
    this.close();
  },

  render: function() {
    const state = this.state;
    const store: Store = this.state.store;
    const subject: NotfSubject = this.state.subject;
    const currentLevel: NotfLevel = this.state.currentLevel || NotfLevel.Normal;
    let watchingAllListItem;
    let watchingFirstListItem;
    let mutedListItem;

    if (state.isOpen) {
      dieIf(!subject.pageId && !subject.tagLabel, 'EsE4GK02');
      const watchingAllText = subject.tagLabel
        ? "You'll be notified of new topics with this tag, and every post in those topics"
        : "You'll be notified of all new replies in this topic.";

      watchingAllListItem = !subject.pageId ? null :
        ExplainingListItem({
          active: currentLevel === NotfLevel.WatchingAll,
          title: r.span({ className: '' }, "Watching All"),
          text: watchingAllText,
          onSelect: () => this.setNotfLevel(NotfLevel.WatchingAll) });
      watchingFirstListItem = !subject.tagLabel ? null :
        ExplainingListItem({
          active: currentLevel === NotfLevel.WatchingFirst,
          title: r.span({className: ''}, "Watching First"),
          text: "You'll be notified of new topics with this tag",
          onSelect: () => this.setNotfLevel(NotfLevel.WatchingFirst) });
      mutedListItem =
        ExplainingListItem({
          active: currentLevel === NotfLevel.Muted,
          title: r.span({ className: '' }, "Muted"),
          text: "No notifications at all about this topic.",
          onSelect: () => this.setNotfLevel(NotfLevel.Muted) });
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true },
        watchingAllListItem,
        watchingFirstListItem,
        /*
        ExplainingListItem({
          active: currentLevel === NotfLevel.Tracking,
          title: r.span({ className: '' }, "Tracking"),
          text: r.span({}, "??"),
          onSelect: () => this.setNotfLevel(NotfLevel.Tracking) }),
          */
        ExplainingListItem({
          active: currentLevel === NotfLevel.Normal,
          title: r.span({ className: '' }, "Normal"),
          text: r.span({}, "You'll be notified if someone replies to you or mentions your ",
              r.samp({}, "@name"), "."),
          onSelect: () => this.setNotfLevel(NotfLevel.Normal) }),
        mutedListItem));
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
