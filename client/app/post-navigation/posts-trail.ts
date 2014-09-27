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

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;

var visitedPosts = [];
var currentVisitedPostIndex = -1;


var PostNavigation = React.createClass({
  canGoBack: function() {
    return this.props.currentVisitedPostIndex >= 1;
  },
  canGoForward: function() {
    return this.props.currentVisitedPostIndex >= 0 &&
        this.props.currentVisitedPostIndex < this.props.visitedPosts.length - 1;
  },
  componentDidMount: function() {
    key('b', this.goBack);
    key('f', this.goForward);
  },
  componentWillUnmount: function() {
    key.unbind('b', this.goBack);
    key.unbind('f', this.goForward);
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
      $('html, body').animate({
        'scrollTop': backPost.windowTop,
        'scrollLeft': backPost.windowLeft
      }, 'slow', 'swing').queue(function(next) {
        d.i.showAndHighlightPost($('#post-' + backPost.postId));
        next();
      });
    }
    else {
      d.i.showAndHighlightPost($('#post-' + backPost.postId));
    }
  },
  goForward: function() {
    if (!this.canGoForward()) return;
    var forwPost = this.props.visitedPosts[this.props.currentVisitedPostIndex + 1];
    this.props.increaseCurrentPostIndex();
    d.i.showAndHighlightPost($('#post-' + forwPost.postId));
  },
  render: function() {
    var buttons = [];
    buttons.push(
        r.button({
            id: 'dw-post-nav-back-btn', onClick: this.goBack, className: 'btn btn-default',
                disabled: !this.canGoBack() },
            r.span({}, 'B'), 'ack'));
    buttons.push(
        r.button({
            id: 'dw-post-nav-forw-btn', onClick: this.goForward, className: 'btn btn-default',
                disabled: !this.canGoForward() },
            r.span({}, 'F'), 'orward'));
    return this.props.visitedPosts.length === 0 ? null : r.div({ id: 'dw-post-nav-panel'}, buttons);
  }
});


export function renderPostNavigationPanel() {
  React.renderComponent(
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
