/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../react-elements/name-login-btns.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../oop-methods.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var DropdownModal = utils.DropdownModal;
var ExplainingListItem = util.ExplainingListItem;


var notfsLevelDropdownModal;

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
    d.i.showReplyFormEmbeddedComments();
  },

  onToggleDetailsClick: function() {
    this.state.ui.showDetails = !this.state.ui.showDetails;
    this.setState(this.state);
  },

  summarizeReplies: function() {
    ReactActions.summarizeReplies();
    setTimeout(() => {
      this.setState({ numRepliesSummarized: $('.dw-p.dw-x').length });
    }, 1);
  },

  render: function() {
    var store: Store = this.state.store;
    var ui = this.state.ui;
    var me: Myself = store.me;

    var notfLevelElem = me.isAuthenticated && !ui.showDetails
      ? r.span({ className: 'dw-page-notf-level', onClick: this.onToggleDetailsClick },
          'Notifications: ' + notfLevel_title(me.rolePageSettings.notfLevel))
      : null;

    var toggleDetailsBtn = !me.isLoggedIn ? null :
        r.button({ className: 'dw-cmts-tlbr-open', onClick: this.onToggleDetailsClick },
          r.span({ className: (ui.showDetails ? 'icon-up-open' : 'icon-down-open') }))

    var nameLoginBtns = store.isInEmbeddedCommentsIframe ?
        r.li({}, reactelements.NameLoginBtns({})) : null;

    var summaryElem =
      r.div({ className: 'dw-cmts-tlbr-head' },
          r.ul({ className: 'dw-cmts-tlbr-summary' },
              r.li({ className: 'dw-cmts-count' }, store.numPostsRepliesSection + " replies"),
              nameLoginBtns,
              r.li({}, notfLevelElem)),
          toggleDetailsBtn);

    var detailsElem = ui.showDetails
      ? MetabarDetails({ store: store })
      : null;

    var anyExtraMeta;
    if (store.pageRole === PageRole.FormalMessage) {
      var members = store_getPageMembersList(store);
      var memberList = members.map((user) => {
        return (
            r.div({ className: 'esMetabar_msgMmbr', key: user.id },
              avatar.Avatar({ user: user, tiny: true }),
              r.span({ className: 'esMetabar_msgMmbr_username' }, user.username)));
      });
      anyExtraMeta =
          r.div({ className: 'esMetabar_extra' },
            r.div({ className: 'icon-mail' }, "Message"),
            r.div({ className: 'esMetabar_msgMmbrs' },
              memberList));
    }

    // ----- Summarize replies section

    var summarizeStuff;
    if (store.numPostsRepliesSection >= 10) {
      var doneSummarizing = !_.isNumber(this.state.numRepliesSummarized) ? null :
          r.span({ style: { marginLeft: '1em' }},
            "Done.");
          // Don't show num summarized — only visiblie replies are summarized, so
          // the count would be confusingly low.
          // So don't:  Summarized " + this.state.numRepliesSummarized + " replies.");
      var minutes = estimateReadingTimeMinutesSkipOrigPost(<Post[]> _.values(store.postsByNr));
      if (minutes >= 10 || store.numPostsRepliesSection >= 20) {
        summarizeStuff =
          r.div({ className: 'esMetabar_summarize' },
            r.p({}, "There are " + store.numPostsRepliesSection + " replies. " +
              "Estimated reading time: " + Math.ceil(minutes) + " minutes"),
            Button({ onClick: this.summarizeReplies }, "Summarize Replies"), doneSummarizing);
      }
    }

    // ----- Put everything together

    var result;
    if (store.isInEmbeddedCommentsIframe) {
      // There's not root post with a reply button, so add a reply button.
      // And an admin button, if is admin.
      var adminLink;
      if (me.isAdmin) {
        adminLink =
          r.a({ className: 'dw-a dw-a-reply', href: d.i.serverOrigin + '/-/admin/#/moderation',
              target: '_blank' }, 'Administrate');
      }
      result =
        r.div({},
          r.div({ className: 'dw-t dw-depth-0 dw-ar-t' },
            r.div({ className: 'dw-p-as dw-as' },
              r.a({ className: 'dw-a dw-a-reply icon-reply', onClick: this.onReplyClick },
                'Reply'),
              adminLink)),
          r.div({ className: 'dw-cmts-tlbr esMetabar' },
            summaryElem,
            detailsElem,
            anyExtraMeta));
    }
    else {
      result =
        r.div({ className: 'dw-cmts-tlbr esMetabar', id: 'dw-cmts-tlbr' },
          summaryElem,
          detailsElem,
          anyExtraMeta,
          summarizeStuff);
    }

    return result;
  }
});


var MetabarDetails = createComponent({
  render: function() {
    var store: Store = this.props.store;
    var user = store.user;
    var userAuthenticated = user && user.isAuthenticated;
    var notfLevel: NotfLevel = user.rolePageSettings.notfLevel;

    var notificationsElem = !userAuthenticated ? null :
      r.div({},
        r.div({ className: 'esMB_Dtls_Ntfs_Lbl' }, "Notifications about this topic:"),
        Button({ id: '7bw3gz5', className: 'dw-notf-level', onClick: event => {
              openNotfsLevelDropdown(event.target, { pageId: d.i.pageId }, notfLevel)
            }},
          r.span({}, notfLevel_title(notfLevel) + ' ', r.span({ className: 'caret' }))));

    return (
      r.div({ className: 'dw-cmts-tlbr-details' },
          notificationsElem));
  }
});


// some dupl code [6KUW24]
var NotfsLevelDropdownModal = createComponent({
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
    var rect = at.getBoundingClientRect();
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
    var subject: NotfSubject = this.state.subject;
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
    var state = this.state;
    var store: Store = this.state.store;
    var me: Myself = store.me;
    var subject: NotfSubject = this.state.subject;
    var currentLevel: NotfLevel = this.state.currentLevel || NotfLevel.Normal;
    var watchingAllListItem;
    var watchingFirstListItem;
    var mutedListItem;

    if (state.isOpen) {
      dieIf(!subject.pageId && !subject.tagLabel, 'EsE4GK02');
      var watchingAllText = subject.tagLabel
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
  var wordsPerMinute = 120;
  // Google "average word length" –> "English, French, Spanish and German are approximately
  // 5.10, 5.13, 5.22 and 6.26" (www.puchu.net/doc/Average_Word_Length),
  // Russian: 5.3 (http://arxiv.org/pdf/1208.6109.pdf)
  //    — so let's use 5.2.
  // But what about Chinese and Japanese?
  var averageWordLength = 5.2;
  // % html chars varies between 60% and 95% ? fairly much depending on how many <a href=...>
  // there are in comparison to the amount of visible text.
  var removeHtml = 0.8; // guessing that 20% chars is html tags and classes and href=...
  var numChars = _.sumBy(posts, (post: Post) => {
    // Exclude the original post.
    if (post.nr === BodyNr || post.nr === TitleNr) return 0;
    return post.sanitizedHtml ? post.sanitizedHtml.length : 0
  });
  var numWords = numChars * removeHtml / averageWordLength;
  return numWords / wordsPerMinute;
}

// Don't use, only for testing.
export var debugEstimateReadingTime = estimateReadingTimeMinutesSkipOrigPost;


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
