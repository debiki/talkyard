/* Buttons that go to the next/previous post or backwards and forwards.
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
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.postnavigation {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;

var visitedPosts = [];
var currentVisitedPostIndex = -1;


var PostNavigation = createClassAndFactory({
  canGoBack: function() {
    return this.props.currentVisitedPostIndex >= 1;
  },

  canGoForward: function() {
    return this.props.currentVisitedPostIndex >= 0 &&
        this.props.currentVisitedPostIndex < this.props.visitedPosts.length - 1;
  },

  componentDidMount: function() {
    keymaster('b', this.goBack);
    keymaster('f', this.goForward);
    window.addEventListener('scroll', this.hideIfCloseToTop, false);
  },

  componentWillUnmount: function() {
    keymaster.unbind('b', this.goBack);
    keymaster.unbind('f', this.goForward);
    window.removeEventListener('scroll', this.hideIfCloseToTop, false);
  },

  hideIfCloseToTop: function() {
    var node = this.getDOMNode();
    if (!node)
      return;

    if (node.getBoundingClientRect().top < 30 && $(window).scrollTop() < 100) {
      $(node).hide();
    }
    else {
      $(node).show();
    }
  },

  goBack: function() {
    if (!this.canGoBack()) return;
    var backPost = this.props.visitedPosts[this.props.currentVisitedPostIndex - 1];
    this.props.decreaseCurrentPostIndex();
    if (typeof backPost.windowLeft !== 'undefined' && (
        backPost.windowLeft !== $(window).scrollLeft() ||
        backPost.windowTop !== $(window).scrollTop())) {
      // Restore the original window top and left coordinates, so the Back button
      // really moves back to the original position.
      var htmlBody = $('html, body').animate({
        'scrollTop': backPost.windowTop,
        'scrollLeft': backPost.windowLeft
      }, 'slow', 'swing');
      if (backPost.postId) {
        htmlBody.queue(function(next) {
          d.i.showAndHighlightPost($('#post-' + backPost.postId));
          next();
        });
      }
    }
    else {
      d.i.showAndHighlightPost($('#post-' + backPost.postId));
    }
  },

  goForward: function() {
    if (!this.canGoForward()) return;
    var forwPost = this.props.visitedPosts[this.props.currentVisitedPostIndex + 1];
    this.props.increaseCurrentPostIndex();
    if (forwPost.postId) {
      d.i.showAndHighlightPost($('#post-' + forwPost.postId));
    }
    else if (forwPost.windowTop) {
      $('html, body').animate({
        'scrollTop': forwPost.windowTop,
        'scrollLeft': forwPost.windowLeft
      }, 'slow', 'swing');
    }
    else {
      throw new Error('DwE49dFK2');
    }
  },

  render: function() {
    var buttons = [];
    buttons.push(
        r.button({
            id: 'dw-post-nav-back-btn', onClick: this.goBack, className: 'btn btn-default',
                disabled: !this.canGoBack() },
            r.span({ className: 'dw-shortcut' }, 'B'), 'ack'));
    buttons.push(
        r.button({
            id: 'dw-post-nav-forw-btn', onClick: this.goForward, className: 'btn btn-default',
                disabled: !this.canGoForward() },
            r.span({ className: 'dw-shortcut' }, 'F'),
              r.span({ className: 'dw-narrow' }, 'wd'),
              r.span({ className: 'dw-wide' }, 'orward')));
    return this.props.visitedPosts.length === 0 ? null : r.div({ id: 'dw-post-nav-panel'}, buttons);
  }
});


export function renderPostNavigationPanel() {
  React.render(
      PostNavigation({
        decreaseCurrentPostIndex: () => {
          currentVisitedPostIndex -= 1;
          renderPostNavigationPanel();
        },
        increaseCurrentPostIndex: () => {
          currentVisitedPostIndex += 1;
          renderPostNavigationPanel();
        },
        visitedPosts: visitedPosts,
        currentVisitedPostIndex: currentVisitedPostIndex
      }),
      document.getElementById('dw-posts-navigation'));
}


export function addVisitedPosts(currentPostId: number, nextPostId: number) {
  visitedPosts.splice(currentVisitedPostIndex + 1, 999999);
  if (visitedPosts.length && visitedPosts[visitedPosts.length - 1].postId === currentPostId) {
    // Don't duplicate postId.
    visitedPosts.splice(visitedPosts.length - 1, 1);
  }
  visitedPosts.push({
    windowLeft: $(window).scrollLeft(),
    windowTop: $(window).scrollTop(),
    postId: currentPostId
  });
  visitedPosts.push({ postId: nextPostId });
  currentVisitedPostIndex = visitedPosts.length - 1;
  renderPostNavigationPanel();
}


export function addVisitedPositionAndPost(nextPostId: number) {
  addVisitedPosts(null, nextPostId);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
