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
/// <reference path="../../typedefs/lodash/lodash.d.ts" />
/// <reference path="../renderer/model.ts" />
/// <reference path="../renderer/posts.ts" />

// Staying at the bottom: http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html

//------------------------------------------------------------------------------
   module debiki2.sidebar {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;


export var RecentComments = createComponent({
  render: function() {
    var commentsByTimeDesc: Post[] = [];
    _.each(this.props.allPosts, (post: Post) => {
      if (post.postId !== TitleId || post.postId !== BodyPostId) {
        commentsByTimeDesc.push(post);
      }
    });

    commentsByTimeDesc.sort((a, b) => {
      if (a.createdAt < b.createdAt)
        return +1;

      if (a.createdAt < b.createdAt)
        return -1;

      return a.postId < b.postId ? +1 : -1;
    });

    commentsByTimeDesc = _.take(commentsByTimeDesc, 15);

    var commentsElems = commentsByTimeDesc.map((post) => {
      var scrollToPost = (event) => {
        d.i.showAndHighlightPost($('#post-' + post.postId));
      } 
      return (
        Post({ post: post, user: this.props.user, allPosts: this.props.allPosts,
          onClick: scrollToPost, skipIdAttr: true }));
    });

    return (
      r.div({ className: 'dw-recent-comments' },
        commentsElems));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
