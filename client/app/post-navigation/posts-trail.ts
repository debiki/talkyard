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
/// <reference path="../utils/react-utils.ts" />

//------------------------------------------------------------------------------
   module debiki2.postnavigation {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = React.createFactory(ReactBootstrap.Button);

export var addVisitedPosts: (currentPostId: number, nextPostId: number) => void = null;
export var addVisitedPositionAndPost: (nextPostId: number) => void = null;


export var PostNavigation = debiki2.utils.createClassAndFactory({
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
    this.setState({
      visitedPosts: visitedPosts,
      currentVisitedPostIndex: visitedPosts.length - 1,
      hideIfTotallyBack: false,
    });
  },

  addVisitedPositionAndPost: function(nextPostId: number) {
    this.addVisitedPosts(null, nextPostId);
  },

  canGoBack: function() {
    return this.state.currentVisitedPostIndex >= 1;
  },

  canGoForward: function() {
    return this.state.currentVisitedPostIndex >= 0 &&
        this.state.currentVisitedPostIndex < this.state.visitedPosts.length - 1;
  },

  componentDidMount: function() {
    addVisitedPosts = this.addVisitedPosts;
    addVisitedPositionAndPost = this.addVisitedPositionAndPost;
    keymaster('b', this.goBack);
    keymaster('f', this.goForward);
    window.addEventListener('scroll', this.hideIfCloseToTop, false);
  },

  componentWillUnmount: function() {
    addVisitedPosts = null;
    addVisitedPositionAndPost = null;
    keymaster.unbind('b', this.goBack);
    keymaster.unbind('f', this.goForward);
    window.removeEventListener('scroll', this.hideIfCloseToTop, false);
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
          ReactActions.loadAndShowPost(backPost.postId);
          next();
        });
      }
    }
    else {
      ReactActions.loadAndShowPost(backPost.postId);
    }
  },

  clearBackList: function() {
    this.setState({
      visitedPosts: [],
      currentVisitedPostIndex: -1,
      hideIfTotallyBack: true,
    });
  },

  // Only invokable via the 'F' key — I rarely go forwards, and a button makes the UI to cluttered.
  goForward: function() {
    if (!this.canGoForward()) return;
    var forwPost = this.state.visitedPosts[this.state.currentVisitedPostIndex + 1];
    this.setState({
      currentVisitedPostIndex: this.state.currentVisitedPostIndex + 1,
      hideIfTotallyBack: false,
    });
    if (forwPost.postId) {
      ReactActions.loadAndShowPost(forwPost.postId);
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
    if (this.state.currentVisitedPostIndex <= 0 && this.state.hideIfTotallyBack)
      return null;

    var scrollBackButton =
          Button({ className: 'dw-scrollback', onClick: this.goBack },
              r.span({ className: 'icon-down-dir' },
                "Scroll ", r.span({ style: { fontWeight: 'bold' }}, "B"), "ack (" +
                    this.state.currentVisitedPostIndex + ")"));
    var clearScrollBackButton =
          Button({ className: 'dw-clear-scroll', onClick: this.clearBackList },
              r.span({ className: ' icon-cancel-circled' }));
    return (
      r.span({}, clearScrollBackButton, scrollBackButton));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
