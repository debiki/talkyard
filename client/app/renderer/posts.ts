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
/// <reference path="../../typedefs/moment/moment.d.ts" />

// Wrapping in a module causes an ArrayIndexOutOfBoundsException: null error, see:
//  http://stackoverflow.com/questions/26189940/java-8-nashorn-arrayindexoutofboundsexception
// The bug has supposedly been fixed in Java 8u40. Once I'm using that version,
// remove `var exports = {};` from app/debiki/ReactRenderer.scala.
//------------------------------------------------------------------------------
  // module debiki2.renderer {
module boo {
    export var buu = 'vovvar';
};
//------------------------------------------------------------------------------

var r = React.DOM;

var TitleId = 0;
var BodyPostId = 1;

var allPosts = {
  0: {
    postId: 0,
    parentId: null,
    authorId: 1,
    authorFullName: 'Full Name',
    authorUsername: 'AuthorUsername',
    createdAt: 1234567890,
    childIds: [],
    text: 'Title',
  },
  1: {
    postId: 1,
    parentId: null,
    authorId: 1,
    authorFullName: 'Full Name',
    authorUsername: 'AuthorUsername',
    createdAt: 1234567890,
    childIds: [2, 3],
    text: 'Body',
  },
  2: {
    postId: 2,
    parentId: 1,
    authorId: 1,
    authorUsername: 'AuthorUsername',
    createdAt: 1234567890,
    lastEditAppliedAt: 1234567890,
    numEditors: 1,
    numLikeVotes: 1,
    numWrongVotes: 1,
    numOffTopicVotes: 1,
    childIds: [21],
    text: 'First Comment, post id 2',
  },
  3: {
    postId: 3,
    parentId: 1,
    authorId: 1,
    authorFullName: 'Full Name',
    authorUsername: 'AuthorUsername',
    createdAt: 1234567890,
    lastEditAppliedAt: 1234567890,
    numEditors: 2,
    numLikeVotes: 2,
    numWrongVotes: 2,
    numOffTopicVotes: 2,
    childIds: [],
    text: '2nd Comment, post id 3',
  },
  21: {
    postId: 21,
    parentId: 2,
    authorId: 1,
    authorFullName: 'Full Name',
    createdAt: 1234567890,
    childIds: [],
    text: 'Post 21',
  },
};


var store = {
  horizontalLayout: true,
  allPosts: allPosts,
  rootPostId: BodyPostId
}


var TitleBodyComments = React.createClass({
  render: function() {
    return (
      r.div({},
        Title({ allPosts: this.props.allPosts }),
        RootPost(this.props)));
  },
});


var Title = React.createClass({
  render: function() {
    var titlePost = this.props.allPosts[TitleId];
    return (
      r.div({ className: 'dw-t', id: 'dw-t-0' },
        r.div({ className: 'dw-p dw-p-ttl', id: 'post-0' },
          r.div({ className: 'dw-p-bd' },
            r.div({ className: 'dw-p-bd-blk' },
              r.h1({ className: 'dw-p-ttl' }, titlePost.text))))));
  },
});


var RootPost = React.createClass({
  render: function() {
    var rootPost = this.props.allPosts[this.props.rootPostId];
    var isBody = this.props.rootPostId === BodyPostId;
    var threadClass = 'dw-t dw-depth-0' + horizontalCss(this.props.horizontalLayout);
    var postIdAttr = 'post-' + rootPost.postId;
    var postClass = 'dw-p';
    var postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t';
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    var spaceForHorizontalArrows = null;
    if (this.props.horizontalLayout) {
      spaceForHorizontalArrows = r.div({ className: 'dw-t-vspace' });
    }

    var children = rootPost.childIds.map((childId) => {
      return (
        r.li({},
          Thread({ allPosts: this.props.allPosts, postId: childId, depth: 1 })));
    });

    return (
      r.div({ className: threadClass },
        r.div({ className: postClass, id: postIdAttr },
          r.div({ className: postBodyClass },
            r.div({ className: 'dw-p-bd-blk' }, rootPost.text))),
        PostActions({ post: rootPost }),
        debiki2.reactelements.CommentsToolbar(),
        spaceForHorizontalArrows,
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            children))));
  },
});


var Thread = React.createClass({
  render: function() {
    var post = this.props.allPosts[this.props.postId];
    var deeper = this.props.depth + 1;
    var depthClass = 'dw-depth-' + this.props.depth;

    var children = post.childIds.map((childId) => {
      return (
        r.li({},
          Thread({ allPosts: this.props.allPosts, postId: childId, depth: deeper })));
    });

    return (
      r.div({ className: 'dw-t ' + depthClass },
        Post({ post: post }),
        PostActions({ post: post }),
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            children))));
  },
});


var Post = React.createClass({
  render: function() {
    var post = this.props.post;
    var authorUrl = '/-/users/#/id/' + post.authorId;
    return (
      r.div({ className: 'dw-p', id: 'post-' + post.postId },
        PostHeader({ post: post }),
        PostBody({ post: post })));
  }
});


var PostHeader = React.createClass({
  render: function() {
    var post = this.props.post;

    var authorUrl = '/-/users/#/id/' + this.props.authorId;
    var authorNameElems;
    if (post.authorFullName && post.authorUsername) {
      authorNameElems = [
        r.span({ className: 'dw-username' }, post.authorUsername),
        r.span({ className: 'dw-fullname' }, ' (', post.authorFullName, ')')];
    }
    else if (post.authorFullName) {
      authorNameElems = r.span({ className: 'dw-fullname' }, post.authorFullName);
    }
    else if (post.authorUsername) {
      authorNameElems = r.span({ className: 'dw-username' }, post.authorUsername);
    }
    else {
      authorNameElems = r.span({}, '(Unknown author)');
    }

    var createdAt = moment.unix(post.createdAt).fromNow();

    var editInfo = null;
    if (post.lastEditAppliedAt) {
      var editedAt = moment.unix(post.lastEditAppliedAt).fromNow();
      var byVariousPeople = post.numEditors > 1 ? ' by various people' : null;
      editInfo =
        r.span({}, ', edited ', editedAt, byVariousPeople);
    }

    function numPeople(num) {
      if (voteInfo) {
        return num + ' ';
      }
      else {
        return num > 1 ? num + ' people ' : num + ' person ';
      }
    }
    function thisComment() {
      return voteInfo ? ' it ' : ' this comment ';
    }
    var voteInfo = '';
    if (post.numLikeVotes) {
      voteInfo += numPeople(post.numLikeVotes) +
        (post.numWrongVotes == 1 ? 'likes' : 'like') + ' this comment';
    }
    if (post.numWrongVotes) {
      if (voteInfo.length > 0) voteInfo += ', ';
      voteInfo += numPeople(post.numWrongVotes) +
        (post.numWrongVotes == 1 ? 'thinks' : 'think') + thisComment() + 'is wrong';
    }
    if (post.numOffTopicVotes) {
      if (voteInfo.length > 0) voteInfo += ', ';
      voteInfo += numPeople(post.numWrongVotes) +
          (post.numWrongVotes == 1 ? 'thinks' : 'think') + thisComment() + 'is off-topic';
    }
    if (voteInfo) voteInfo += '.';

    return (
        r.div({ className: 'dw-p-hd' },
          r.a({ className: 'dw-p-link' }, '#', post.postId),
          r.a({ className: 'dw-p-by', href: authorUrl }, authorNameElems),
          createdAt,
          editInfo, '. ',
          voteInfo));
  }
});


var PostBody = React.createClass({
  render: function() {
    var post = this.props.post;
    return (
      r.div({ className: 'dw-p-bd' },
        r.div({ className: 'dw-p-bd-blk' }, post.text)));
  }
});


var PostActions = React.createClass({
  render: function() {
    var post = this.props.post;

    var replyLikeWrongLinks = null;
    if (!post.isDeletedSomehow) {
      // They float right, so they're placed in reverse order.
      replyLikeWrongLinks = [
        r.a({ className: 'dw-a dw-a-warning icon-warning',
          title: 'Click if you think this post is wrong' }, 'Wrong'),
        r.a({ className: 'dw-a dw-a-like icon-heart', title: 'Like this' }, 'Like'),
        r.a({ className: 'dw-a dw-a-reply icon-reply' }, 'Reply')];
    }

    return (
      r.div({ className: 'dw-p-as dw-as' },
        replyLikeWrongLinks));
  }
});


function horizontalCss(horizontal) {
    return horizontal ? ' dw-hz' : '';
}


function renderTitleBodyComments() {
  var root = document.getElementById('dwPosts');
  if (!root) return;
  React.renderComponent(TitleBodyComments(store), root);
}


function renderTitleBodyCommentsToString() {
  return React.renderComponentToString(TitleBodyComments(store));
}

//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
