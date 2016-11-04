/* Buttons that go to the next/previous post or backwards and forwards.
 * Copyright (C) 2014-2016 Kaj Magnus Lindberg
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
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../utils/DropdownModal.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var r = React.DOM;
var calcScrollIntoViewCoordsInPageColumn = debiki2.utils.calcScrollIntoViewCoordsInPageColumn;

export var addVisitedPosts: (currentPostId: number, nextPostId: number) => void = _.noop;
export var addVisitedPositionAndPost: (nextPostId: number) => void = _.noop;
export var addVisitedPosition: (whereNext?) => void = _.noop;

var WhereTop = 'T';
var WhereReplies = 'R';
var WhereBottom = 'B';
var SmallDistancePx = 5;

function scrollToTop(addBackStep?) {
  if (addBackStep !== false) {
    addVisitedPosition(WhereTop);
  }
  utils.scrollIntoViewInPageColumn($('#thePageTop'));
}

function scrollToReplies(addBackStep?) {
  if (addBackStep !== false) {
    addVisitedPosition(WhereReplies);
  }
  utils.scrollIntoViewInPageColumn(
    // dupl code [5UKP20]
    $('.dw-depth-0 > .dw-p-as'), { marginTop: 65, marginBottom: 9999 });
}

function scrollToBottom(addBackStep?) {
  if (addBackStep !== false) {
    addVisitedPosition(WhereBottom);
  }
  // dupl code [5UKP20]
  utils.scrollIntoViewInPageColumn($('#thePageBottom'));
}


var scrollButtonsDialog;

function openScrollButtonsDialog(openButton) {
  if (!scrollButtonsDialog) {
    scrollButtonsDialog = ReactDOM.render(ScrollButtonsDropdownModal(), utils.makeMountNode());
  }
  scrollButtonsDialog.openAt(openButton);
}


export var ScrollButtons = createClassAndFactory({
  getInitialState: function() {
    return {
      visitedPosts: [],
      currentVisitedPostIndex: -1,
      isShown: false,
    };
  },

  componentDidMount: function() {
    // Similar code here: [5KFEWR7]
    // COULD_OPTIMIZE? Perhaps sync all those time callbacks, so done in same reflow?
    setTimeout(this.showOrHide, 250);

    addVisitedPosts = this.addVisitedPosts;
    addVisitedPositionAndPost = this.addVisitedPositionAndPost;
    addVisitedPosition = this.addVisitedPosition;
    keymaster('b', this.goBack);
    keymaster('f', this.goForward);
    keymaster('1', scrollToTop);
    keymaster('2', scrollToReplies);
    keymaster('3', scrollToBottom);
  },

  componentWillUnmount: function() {
    this.isGone = true;
    addVisitedPosts = _.noop;
    addVisitedPositionAndPost = _.noop;
    addVisitedPosition = _.noop;
    keymaster.unbind('b', 'all');
    keymaster.unbind('f', 'all');
    keymaster.unbind('1', 'all');
    keymaster.unbind('2', 'all');
    keymaster.unbind('3', 'all');
  },

  showOrHide: function() {
    if (this.isGone) return;
    let pageColumn = document.getElementById('esPageScrollable');
    let pageHasScrollbars = pageColumn.scrollHeight > window.innerHeight;
    if (this.state.isShown !== pageHasScrollbars) {
      this.setState({ isShown: pageHasScrollbars });
    }
    setTimeout(this.showOrHide, 500);
  },

  // Crazy with number | string. Oh well, fix later [3KGU02] CLEAN_UP
  addVisitedPosts: function(currentPostId: number, nextPostId: number | string) {
    var visitedPosts = this.state.visitedPosts; // TODO clone, don't modify visitedPosts directly below [immutablejs]
    visitedPosts.splice(this.state.currentVisitedPostIndex + 1, 999999);
    // Don't duplicate the last post, and also remove it if it is empty, which happens when
    // a position without any post is added via this.addVisitedPosition().
    var lastPost = visitedPosts[visitedPosts.length - 1];
    var lastPosHasCoords;
    if (lastPost) {
      lastPosHasCoords = _.isNumber(lastPost.windowLeft) && _.isNumber(lastPost.windowTop);
      var lastPosHasPostNr = !isNullOrUndefined(lastPost.postId);
      var isSameAsCurrent = lastPosHasPostNr && lastPost.postId === currentPostId;
      var isNothing = !lastPosHasPostNr && !lastPosHasCoords;
      if (isSameAsCurrent || isNothing) {
        visitedPosts.splice(visitedPosts.length - 1, 1);
        lastPost = undefined;
        lastPosHasCoords = undefined;
      }
    }
    var currentPos = {
      windowLeft: $('#esPageColumn').scrollLeft(),
      windowTop: $('#esPageColumn').scrollTop(),
      postId: currentPostId
    };
    var lastPosTop = lastPost ? lastPost.windowTop : undefined;
    var lastPosLeft = lastPost ? lastPost.windowLeft : undefined;
    if (lastPost && _.isString(lastPost.postId)) {
      lastPosLeft = _.isNumber(lastPosLeft) ? lastPosLeft : currentPos.windowLeft;
      switch(lastPost.postId) {
        case WhereTop:
          lastPosTop = 0;
          break;
        case WhereBottom:
          // DUPL CODE, fix  [5UKP20]
          lastPosTop = calcScrollIntoViewCoordsInPageColumn($('#thePageBottom')).desiredParentTop;
          break;
        case WhereReplies:
          // DUPL CODE, fix  [5UKP20]
          lastPosTop =
            calcScrollIntoViewCoordsInPageColumn(
                $('.dw-depth-0 > .dw-p-as'), { marginTop: 65, marginBottom: 9999 }).desiredParentTop;
          break;
        default: die('EsE2YWK4X8');
      }
    }
    if (isNullOrUndefined(currentPostId) && lastPost && _.isNumber(lastPost.postId) &&
        !_.isNumber(lastPosTop)) {
      var $post = $('#post-' + lastPost.postId);
      var scrollCoords = calcScrollIntoViewCoordsInPageColumn($post);
      lastPosTop = scrollCoords.desiredParentTop;
      lastPosLeft = scrollCoords.desiredParentLeft;
    }
    if (_.isNumber(currentPostId) || !_.isNumber(lastPosTop)) {
      visitedPosts.push(currentPos);
    }
    else {
      // If currentPos is almost the same as lastPost, skip currentPos.
      var distX = currentPos.windowLeft - lastPosLeft;
      var distY = currentPos.windowTop - lastPosTop;
      var distSquared = distX * distX + distY * distY;
      // 60 pixels is nothing, only add new pos if has scrolled further away than that.
      if (distSquared > 60*60) {  // COULD use 160 px instead if wide screen
        visitedPosts.push(currentPos);
      }
    }
    visitedPosts.push({ postId: nextPostId });
    this.setState({
      visitedPosts: visitedPosts,
      currentVisitedPostIndex: visitedPosts.length - 1,
    });
  },

  addVisitedPositionAndPost: function(nextPostId: number) {
    this.addVisitedPosts(null, nextPostId);
  },

  addVisitedPosition: function(whereNext?) {
    this.addVisitedPosts(null, whereNext);
  },

  canGoBack: function() {
    return this.state.currentVisitedPostIndex >= 1;
  },

  canPerhapsGoForward: function() {
    return this.state.currentVisitedPostIndex >= 0 &&
        this.state.currentVisitedPostIndex < this.state.visitedPosts.length - 1;
  },

  openScrollButtonsDialog: function(event) {
    openScrollButtonsDialog(event.target);
  },

  goBack: function() {
    if (!this.canGoBack()) return;
    var backPost = this.state.visitedPosts[this.state.currentVisitedPostIndex - 1];
    var nextIndex = this.state.currentVisitedPostIndex - 1;
    this.setState({
      currentVisitedPostIndex: nextIndex,
    });
    var pageColumn = $('#esPageColumn');
    if (_.isNumber(backPost.windowLeft) && (
        backPost.windowLeft !== pageColumn.scrollLeft() ||
        backPost.windowTop !== pageColumn.scrollTop())) {
      // Restore the original window top and left coordinates, so the Back button
      // really moves back to the original position.
      var htmlBody = pageColumn.animate({
        'scrollTop': backPost.windowTop,
        'scrollLeft': backPost.windowLeft
      }, 'slow', 'swing');
      if (backPost.postId) {
        htmlBody.queue(function(next) {
          ReactActions.loadAndShowPost(backPost.postId);
          next();
        });
      }
    }
    else if (_.isString(backPost.postId)) {  // crazy, oh well [3KGU02]
      switch (backPost.postId) {
        case WhereTop: scrollToTop(false); break;
        case WhereReplies: scrollToReplies(false); break;
        case WhereBottom: scrollToBottom(false); break;
        default: die('EsE4KGU02');
      }
    }
    else {
      ReactActions.loadAndShowPost(backPost.postId);
    }
  },

  // Only invokable via the 'F' key — I rarely go forwards, and a button makes the UI to cluttered.
  goForward: function() {
    if (!this.canPerhapsGoForward()) return;
    var forwPost = this.state.visitedPosts[this.state.currentVisitedPostIndex + 1];
    if (forwPost.postId) {
      ReactActions.loadAndShowPost(forwPost.postId);
    }
    else if (forwPost.windowTop) {
      $('#esPageColumn').animate({
        'scrollTop': forwPost.windowTop,
        'scrollLeft': forwPost.windowLeft
      }, 'slow', 'swing');
    }
    else {
      // Ignore. Empty objects are added when the user uses the Top/Replies/Chat/End
      // naviation buttons.
      return;
    }
    this.setState({
      currentVisitedPostIndex: this.state.currentVisitedPostIndex + 1,
    });
  },

  render: function() {
    if (!this.state.isShown)
      return null;

    var openScrollMenuButton = Button({ className: 'esScrollBtns_menu', ref: 'scrollMenuButton',
        onClick: this.openScrollButtonsDialog }, "Scroll");

    // UX: Don't show num steps one can scroll back, don't: "Back (4)" — because people
    // sometimes think 4 is a post number.
    var scrollBackButton =
        Button({ className: 'esScrollBtns_back', onClick: this.goBack,
            title: "Scroll back to your previous position on this page",
            disabled: this.state.currentVisitedPostIndex <= 0 },
          r.span({ className: 'esScrollBtns_back_shortcut' }, "B"), "ack");

    return (
      r.div({ className: 'esScrollBtns_fixedBar' },
        r.div({ className: 'container' },
          r.div({ className: 'esScrollBtns' },
            openScrollMenuButton, scrollBackButton))));
  }
});


// some dupl code [6KUW24]
var ScrollButtonsDropdownModal = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      enableGotoTopBtn: false,
      enableGotoEndBtn: true,
      store: ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData() });
  },

  openAt: function(at) {
    var rect = at.getBoundingClientRect();
    var calcCoords = calcScrollIntoViewCoordsInPageColumn;
    var bottomCoords = calcCoords($('#thePageBottom'), {
      marginTop: SmallDistancePx,
      marginBottom: -SmallDistancePx,
    });
    this.setState({
      isOpen: true,
      atX: rect.left - 160,
      atY: rect.bottom,
      enableGotoTopBtn: $('#esPageColumn').scrollTop() > SmallDistancePx,
      enableGotoEndBtn: bottomCoords.needsToScroll,
      enableGotoRepliesBtn:
        calcCoords($('.dw-depth-0 > .dw-p-as'), { marginTop: 65, marginBottom: 200 }).needsToScroll,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  scrollToTop: function() {
    scrollToTop();
    this.close();
  },

  scrollToReplies: function() {
    scrollToReplies();
    this.close();
  },

  scrollToEnd: function() {
    scrollToBottom();
    this.close();
  },

  render: function() {
    var state = this.state;
    var store: Store = this.state.store;
    var pageRole: PageRole = store.pageRole;
    var isChat = page_isChatChannel(pageRole);
    var neverHasReplies = pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.WebPage ||
        isSection(pageRole);

    var content;
    if (state.isOpen) {
      var topHelp = "Go to the top of the page. Shortcut: 1 (on the keyboard)";
      var repliesHelp = "Go to the start of replies section. Shortcut: 2";
      var endHelp = "Go to the bottom of the page. Shortcut: 3";

      var scrollToTopButton = isChat ? null :
        PrimaryButton({ className: 'esScrollDlg_Up', onClick: this.scrollToTop, title: topHelp,
            disabled: !state.enableGotoTopBtn },
          r.span({},
            r.span({ className: 'esScrollDlg_Up_Arw' }, '➜'), "Page top"));

      var scrollToRepliesButton = isChat || neverHasReplies ? null :
        PrimaryButton({ className: 'esScrollDlg_Replies', onClick: this.scrollToReplies,
            title: repliesHelp, disabled: !state.enableGotoRepliesBtn },
          r.span({ className: 'icon-comment' }, "Replies"));

      var scrollToEndButton = PrimaryButton({ className: 'esScrollDlg_Down',
          onClick: this.scrollToEnd, title: endHelp,
          disabled: !state.enableGotoEndBtn },
        r.span({},
          r.span({ className: 'esScrollDlg_Down_Arw' }, '➜'), isChat ? "Page bottom" : "Bottom"));

      var shortcutsArray = [];
      if (scrollToTopButton) shortcutsArray.push("1");
      if (scrollToRepliesButton) shortcutsArray.push("2");
      if (scrollToEndButton) shortcutsArray.push("3");
      var shortcutsText = shortcutsArray.join(", ");

      content =
          r.div({},
            r.p({ className: 'esScrollDlg_title' }, "Scroll to:"),
              scrollToTopButton, scrollToRepliesButton, scrollToEndButton,
            r.p({ className: 'esScrollDlg_shortcuts' },
              "Keyboard shortcuts: ", r.b({}, shortcutsText),
              ", and ", r.b({}, "B"), " to scroll back"));
    }

    // (allowFullWidth, because this dialog isn't tall, so will be space above/below to click
    // to close.)
    return (
      utils.DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true, className: 'esScrollDlg', allowFullWidth: true }, content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
