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

var visitedPostIds = [];
var currentVisitedPostIndex = -1;


var PostNavigation = React.createClass({
  canGoBack: function() {
    return this.props.currentVisitedPostIndex >= 1;
  },
  canGoForward: function() {
    return this.props.currentVisitedPostIndex >= 0 &&
        this.props.currentVisitedPostIndex < this.props.visitedPostIds.length - 1;
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
    var backPostId = this.props.visitedPostIds[this.props.currentVisitedPostIndex - 1];
    this.props.decreaseCurrentPostIndex();
    d.i.showAndHighlightPost($('#post-' + backPostId));
  },
  goForward: function() {
    if (!this.canGoForward()) return;
    var forwPostId = this.props.visitedPostIds[this.props.currentVisitedPostIndex + 1];
    this.props.increaseCurrentPostIndex();
    d.i.showAndHighlightPost($('#post-' + forwPostId));
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
    return this.props.visitedPostIds.length === 0 ? null : r.div({ id: 'dw-post-nav-panel'}, buttons);
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
        visitedPostIds: visitedPostIds,
        currentVisitedPostIndex: currentVisitedPostIndex
      }),
      document.getElementById('dw-posts-navigation'));
}


export function addVisitedPosts(currentPostId: number, nextPostId: number) {
  visitedPostIds.splice(currentVisitedPostIndex + 1, 999999);
  if (visitedPostIds.length && visitedPostIds[visitedPostIds.length - 1] === currentPostId) {
    // Don't duplicate postId
  }
  else {
    visitedPostIds.push(currentPostId);
  }
  visitedPostIds.push(nextPostId);
  currentVisitedPostIndex = visitedPostIds.length - 1;
  renderPostNavigationPanel();
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
