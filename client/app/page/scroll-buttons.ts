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
/// <reference path="../utils/DropdownModal.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = React.createFactory(ReactBootstrap.Button);

export var addVisitedPosts: (currentPostId: number, nextPostId: number) => void = _.noop;
export var addVisitedPositionAndPost: (nextPostId: number) => void = _.noop;
export var addVisitedPosition: () => void = _.noop;


var scrollButtonsDialog;

function openScrollButtonsDialog(openButton) {
  if (!scrollButtonsDialog) {
    scrollButtonsDialog = ReactDOM.render(ScrollButtonsDropdownModal(), utils.makeMountNode());
  }
  scrollButtonsDialog.openAt(openButton);
}


export var ScrollButtons = debiki2.utils.createClassAndFactory({
  getInitialState: function() {
    return {
      visitedPosts: [],
      currentVisitedPostIndex: -1,
      hideIfTotallyBack: true,
    };
  },

  addVisitedPosts: function(currentPostId: number, nextPostId: number) {
    var visitedPosts = this.state.visitedPosts; // TODO clone, don't modify visitedPosts directly below [immutablejs]
    visitedPosts.splice(this.state.currentVisitedPostIndex + 1, 999999);
    // Don't duplicate the last post, and also remove it if it is empty, which happens when
    // a position without any post is added via this.addVisitedPosition().
    var lastPost = visitedPosts[visitedPosts.length - 1];
    if (lastPost) {
      var isSameAsCurrent = lastPost.postId === currentPostId;
      var isNothing = !lastPost.postId && !lastPost.windowLeft && !lastPost.windowTop;
      if (isSameAsCurrent || isNothing) {
        visitedPosts.splice(visitedPosts.length - 1, 1);
      }
    }
    visitedPosts.push({
      windowLeft: $('#esPageColumn').scrollLeft(),
      windowTop: $('#esPageColumn').scrollTop(),
      postId: currentPostId
    });
    visitedPosts.push({ postId: nextPostId });
    this.setState({
      visitedPosts: visitedPosts,
      currentVisitedPostIndex: visitedPosts.length - 1,
      hideIfTotallyBack: false,
    });
  },

  addVisitedPositionAndPost: function(nextPostId: number) {
    this.addVisitedPosts(null, nextPostId);
  },

  addVisitedPosition: function() {
    this.addVisitedPosts(null, null);
  },

  canGoBack: function() {
    return this.state.currentVisitedPostIndex >= 1;
  },

  canPerhapsGoForward: function() {
    return this.state.currentVisitedPostIndex >= 0 &&
        this.state.currentVisitedPostIndex < this.state.visitedPosts.length - 1;
  },

  componentDidMount: function() {
    addVisitedPosts = this.addVisitedPosts;
    addVisitedPositionAndPost = this.addVisitedPositionAndPost;
    addVisitedPosition = this.addVisitedPosition;
    keymaster('b', this.goBack);
    keymaster('f', this.goForward);
  },

  componentWillUnmount: function() {
    addVisitedPosts = _.noop;
    addVisitedPositionAndPost = _.noop;
    addVisitedPosition = _.noop;
    keymaster.unbind('b', 'all');
    keymaster.unbind('f', 'all');
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
    if (nextIndex === 0) {
      // Don't hide direcltly, wait half a second so "0" shows so one understands
      // that the scroll back list has ended.
      setTimeout(() => {
        if (this.isMounted() && this.state.currentVisitedPostIndex === 0) {
          this.setState({ hideIfTotallyBack: true });
        }
      }, 600);
    }
    var pageColumn = $('#esPageColumn');
    if (typeof backPost.windowLeft !== 'undefined' && (
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
      hideIfTotallyBack: false,
    });
  },

  render: function() {
    var openScrollMenuButton = Button({ className: 'esScrollBtns_menu', ref: 'scrollMenuButton',
        onClick: this.openScrollButtonsDialog }, "Scroll");

    var scrollBackButton;
    if (this.state.currentVisitedPostIndex >= 1 || !this.state.hideIfTotallyBack) {
      var backHelp = "Scroll back to your previous position on this page";
      // Don't show num steps one can scroll back, don't: "Back (4)" — because people
      // sometimes think 4 is a post number.
      scrollBackButton =
          Button({ className: 'esScrollBtns_back', onClick: this.goBack, title: backHelp },
              r.span({ className: 'esScrollBtns_back_shortcut' }, "B"), "ack");
    }

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
    };
  },

  openAt: function(at) {
    var rect = at.getBoundingClientRect();
    var calcCoords = utils.calcScrollIntoViewCoordsInPageColumn;
    this.setState({
      isOpen: true,
      atX: rect.left - 160,
      atY: rect.bottom,
      enableGotoTopBtn: $('#esPageColumn').scrollTop() > 0,
      enableGotoEndBtn: calcCoords($('#dw-the-end')).needsToScroll,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  scrollToTop: function() {
    addVisitedPosition();
    utils.scrollIntoViewInPageColumn($('.dw-page'), { marginTop: 90, marginBottom: 9999 });
    this.close();
  },

  scrollToReplies: function() {
    addVisitedPosition();
    utils.scrollIntoViewInPageColumn(
        $('.dw-depth-0 > .dw-p-as'), { marginTop: 65, marginBottom: 9999 });
    this.close();
  },

  scrollToEnd: function() {
    addVisitedPosition();
    utils.scrollIntoViewInPageColumn($('#dw-the-end'), { marginTop: 60, marginBottom: 45 });
    this.close();
  },

  render: function() {
    var state = this.state;
    var isChat = this.props.isChat;
    var content;
    if (state.isOpen) {
      var topHelp = "Go to the top of the page. Shortcut: 1 (on the keyboard)";
      var repliesHelp = "Go to the start of replies section. Shortcut: 2";
      var endHelp = "Go to the bottom of the page. Shortcut: 4";
      var scrollToTop = isChat ? null :
        Button({ className: '', onClick: this.scrollToTop, title: topHelp,
          disabled: !state.enableGotoTopBtn }, "Page top");
      var scrollToReplies = isChat ? null :
        Button({ className: '', onClick: this.scrollToReplies, title: repliesHelp }, "Replies");
      var scrollToEnd = Button({ className: '', onClick: this.scrollToEnd, title: endHelp,
        disabled: !state.enableGotoEndBtn }, "Bottom");

      content = r.div({ className: 'esScrollDlg_title'},
        r.p({}, "Scroll to:"),
        scrollToTop, scrollToReplies, scrollToEnd);
    }

    return (
      utils.DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true, className: 'esScrollDlg' }, content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
