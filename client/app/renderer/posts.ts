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

/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../dialogs.ts" />
/// <reference path="model.ts" />

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

var MaxGuestId = -2; // place where?
function isGuest(user: CompleteUser) {
  return user.id <= MaxGuestId;
}

var React = window['React']; // TypeScript file doesn't work
var r = React.DOM;
var $: JQueryStatic = debiki.internal.$;
var ReactRouter = window['ReactRouter'];
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var OverlayTrigger = reactCreateFactory(ReactBootstrap.OverlayTrigger);
var Tooltip = reactCreateFactory(ReactBootstrap.Tooltip);


var ManualReadMark = 1;
var YellowStarMark = 2;
var FirstStarMark = 2;
var BlueStarMark = 3;
var LastStarMark = 3;

function isServerSide() {
  // Don't change this to a static variable, because it'd be initialized rather late,
  // so some code would believe we were running client side.
  return !!window['java'];
}


function createComponent(componentDefinition) {
  if (isServerSide()) {
    // The mere presence of these functions cause an unknown error when rendering
    // React-Router server side. So remove them; they're never called server side anyway.
    // The error logs the message '{}' to console.error(); no idea what that means.
    delete componentDefinition.componentWillUpdate;
    delete componentDefinition.componentWillReceiveProps;
  }
  return React.createFactory(React.createClass(componentDefinition));
}


var PageWithState = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return debiki2.ReactStore.allData();
  },

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
  },

  render: function() {
    return Page(this.state);
  }
});


var Page = createComponent({
  render: function() {
    return TitleBodyComments(this.props);
  }
});


var TitleBodyComments = createComponent({
  //getInitialState: function() {
    //return null; //debiki2.ReactStore.allData();
  //},
  /* any `getInitialState` causes a Nashorn error in react-with-addons.js, here:
  _renderValidatedComponent: ReactPerf.measure(
    'ReactCompositeComponent',
    '_renderValidatedComponent',
    function() {
      var renderedComponent;
      var previousContext = ReactContext.current;
      ReactContext.current = this._processChildContext(
        this._currentElement._context
      );
      ReactCurrentOwner.current = this;
      try {
        renderedComponent = this.render();   <-- render is null, in Nashorn only, not in browser
  */

  render: function() {
    var anyTitle = null;
    if (this.props.pageRole === 'HomePage' || this.props.pageRole === 'EmbeddedComments' ||
        this.props.rootPostId !== BodyPostId) {
      // Show no title for the homepage — it should have its own custom HTML with
      // a title and other things.
      // Embedded comment pages have no title, only comments.
      // And show no title if we're showing a comment not the article as the root post.
    }
    else {
      anyTitle = Title(this.props);
    }

    var anyPostHeader = null;
    var anySocialLinks = null;
    if (this.props.pageRole === 'HomePage' || this.props.pageRole === 'Forum' ||
        this.props.pageRole === 'ForumCategory' || this.props.pageRole === 'WikiMainPage' ||
        this.props.pageRole === 'SpecialContent' || this.props.pageRole === 'Blog' ||
        this.props.pageRole === 'EmbeddedComments' ||
        this.props.rootPostId !== BodyPostId) {
      // Show no author name or social links for these generic pages.
      // And show nothing if we're showing a comment not the article as the root post.
    }
    else {
      anyPostHeader = PostHeader({ post: this.props.allPosts[this.props.rootPostId] });
      anySocialLinks = SocialLinks({ socialLinksHtml: this.props.socialLinksHtml });
    }

    var embeddedClass = this.props.isInEmbeddedCommentsIframe ? ' dw-embedded' : '';

    return (
      r.div({ className: 'debiki dw-debate dw-page' + embeddedClass },
        anyTitle,
        anyPostHeader,
        anySocialLinks,
        RootPostAndComments(this.props)));
  },
});


var Title = createComponent({
  editTitle: function(event) {
    debiki.internal.$showEditForm.call(event.target, event);
  },
  render: function() {
    var titlePost = this.props.allPosts[TitleId];
    if (!titlePost)
      return null;

    var titleText = titlePost.isApproved
        ? titlePost.sanitizedHtml
        : r.i({}, '(Title pending approval)');
    var anyEditTitleBtn;
    if (this.props.user.isAdmin || this.props.user.userId === titlePost.authorId) {
      anyEditTitleBtn =
        r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.editTitle });
    }
    return (
      r.div({ className: 'dw-t', id: 'dw-t-0' },
        r.div({ className: 'dw-p dw-p-ttl', id: 'post-0' },
          r.div({ className: 'dw-p-bd' },
            r.div({ className: 'dw-p-bd-blk' },
              r.h1({ className: 'dw-p-ttl' }, titleText),
              anyEditTitleBtn)))));
  },
});


var SocialLinks = createComponent({
  render: function() {
    if (!this.props.socialLinksHtml)
      return null;

    // The social links config value can be edited by admins only so we can trust it.
    return (
      r.div({ dangerouslySetInnerHTML: { __html: this.props.socialLinksHtml }}));
  }
});


var RootPostAndComments = createComponent({
  showActions: function() {
    if (this.refs.actions) {
      this.refs.actions.showActions();
    }
  },
  render: function() {
    var user = this.props.user;
    var rootPost = this.props.allPosts[this.props.rootPostId];
    if (!rootPost)
      return r.p({}, '(Root post missing [DwE8WVP4])');
    var isBody = this.props.rootPostId === BodyPostId;
    var pageRole = this.props.pageRole;
    var threadClass = 'dw-t dw-depth-0' + horizontalCss(this.props.horizontalLayout);
    var postIdAttr = 'post-' + rootPost.postId;
    var postClass = 'dw-p';
    var postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t';
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    var showComments = pageRole !== 'HomePage' && pageRole !== 'Forum' &&
        pageRole !== 'ForumCategory' && pageRole !== 'Blog' && pageRole !== 'WikiMainPage' &&
        pageRole !== 'SpecialContent';

    var sanitizedHtml = rootPost.isApproved
        ? rootPost.sanitizedHtml
        : '<p>(Text pending approval.)</p>';

    var body = null;
    if (pageRole !== 'EmbeddedComments') {
      body =
        r.div({ className: postClass, id: postIdAttr, onMouseEnter: this.showActions },
          r.div({ className: postBodyClass },
            r.div({ className: 'dw-p-bd-blk',
              dangerouslySetInnerHTML: { __html: sanitizedHtml }})));
    }

    if (!showComments) {
      return (
        r.div({ className: threadClass },
          body,
          NoCommentsPageActions({ post: rootPost, user: user })));
    }

    var anyLikeCount;
    if (rootPost.numLikeVotes >= 1) {
      var peopleLike = rootPost.numLikeVotes === 1 ? ' person likes' : ' people like';
      anyLikeCount =
        r.div({ className: 'dw-num-likes clearfix' },
          r.a({}, rootPost.numLikeVotes, peopleLike, ' this.'));
    }

    var anyHorizontalArrowToChildren = null;
    if (this.props.horizontalLayout) {
      anyHorizontalArrowToChildren =
          debiki2.renderer.drawHorizontalArrowFromRootPost(rootPost);
    }

    var childIds = pageRole === 'EmbeddedComments' ?
        this.props.topLevelCommentIdsSorted : rootPost.childIdsSorted;

    var children = childIds.map((childId, childIndex) => {
      var threadProps = _.clone(this.props);
      threadProps.elemType = 'div';
      threadProps.postId = childId;
      threadProps.index = childIndex;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      return (
        r.li({},
          Thread(threadProps)));
    });

    return (
      r.div({ className: threadClass },
        body,
        PostActions({ post: rootPost, user: user, ref: 'actions' }),
        anyLikeCount,
        debiki2.reactelements.CommentsToolbar(),
        anyHorizontalArrowToChildren,
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            children))));
  },
});


var Thread = createComponent({
  shouldComponentUpdate: function(nextProps, nextState) {
    return nextProps.quickUpdate ? !!nextProps.postsToUpdate[this.props.postId] : true;
  },

  onPostMouseEnter: function() {
    if (this.refs.actions) {
      this.refs.actions.showActions();
    }
  },

  onAnyActionClick: function() {
    this.refs.post.onAnyActionClick();
  },

  render: function() {
    var post: Post = this.props.allPosts[this.props.postId];
    if (!post) {
      // This tree has been deleted it seems
      return null;
    }
    var parentPost = this.props.allPosts[post.parentId];
    var deeper = this.props.depth + 1;

    // Draw arrows, but not to multireplies, because we don't know if they reply to `post`
    // or to other posts deeper in the thread.
    var arrows = [];
    if (!post.multireplyPostIds.length) {
      arrows = debiki2.renderer.drawArrowsFromParent(
        this.props.allPosts, parentPost, this.props.depth, this.props.index,
        this.props.horizontalLayout, this.props.rootPostId);
    }

    var children = [];
    if (!post.isTreeCollapsed && !post.isTreeDeleted) {
      children = post.childIdsSorted.map((childId, childIndex) => {
        var childIndentationDepth = this.props.indentationDepth;
        // All children except for the last one are indented.
        var isIndented = childIndex < post.childIdsSorted.length - 1;
        if (!this.props.horizontalLayout && this.props.depth === 1) {
          // Replies to article replies are always indented, even the last child.
          isIndented = true;
        }
        if (isIndented) {
          childIndentationDepth += 1;
        }
        var threadProps = _.clone(this.props);
        threadProps.elemType = 'li';
        threadProps.postId = childId;
        threadProps.index = childIndex;
        threadProps.depth = deeper;
        threadProps.indentationDepth = childIndentationDepth;
        return (
            Thread(threadProps));
      });
    }

    var actions = isCollapsed(post)
      ? null
      : actions = PostActions({ post: post, user: this.props.user, ref: 'actions',
          onClick: this.onAnyActionClick });

    var baseElem = r[this.props.elemType];

    var postProps = _.clone(this.props);
    postProps.post = post;
    postProps.index = this.props.index;
    postProps.onMouseEnter = this.onPostMouseEnter;
    postProps.ref = 'post';

    var depthClass = ' dw-depth-' + this.props.depth;
    var indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    var multireplyClass = post.multireplyPostIds.length ? ' dw-mr' : '';

    return (
      baseElem({ className: 'dw-t' + depthClass + indentationDepthClass + multireplyClass},
        arrows,
        Post(postProps),
        actions,
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            children))));
  },
});


var Post = createComponent({
  onUncollapseClick: function(event) {
    debiki2.ReactActions.uncollapsePost(this.props.post);
  },

  onClick: function() {
    if (!this.props.abbreviate) {
      debiki2.ReactActions.markPostAsRead(this.props.post.postId, true);
    }
    if (this.props.onClick) {
      this.props.onClick();
    }
  },

  onAnyActionClick: function() {
    debiki2.ReactActions.markPostAsRead(this.props.post.postId, true);
  },

  onMarkClick: function(event) {
    // Try to avoid selecting text:
    event.stopPropagation();
    event.preventDefault();
    debiki2.ReactActions.cycleToNextMark(this.props.post.postId);
  },

  render: function() {
    var post: Post = this.props.post;
    var user: User = this.props.user;
    if (!post)
      return r.p({}, '(Post missing [DwE4UPK7])');

    var pendingApprovalElem;
    var headerElem;
    var bodyElem;
    var extraClasses = this.props.className || '';

    if (post.isTreeDeleted || post.isPostDeleted) {
      var what = post.isTreeDeleted ? 'Thread' : 'Comment';
      headerElem = r.div({ className: 'dw-p-hd' }, what, ' deleted');
      extraClasses += ' dw-p-dl';
    }
    else if (post.isTreeCollapsed || post.isPostCollapsed) {
      var what = post.isTreeCollapsed ? 'more comments' : 'this comment';
      bodyElem = r.a({ className: 'dw-z', onClick: this.onUncollapseClick },
          'Click to show ', what);
      extraClasses += ' dw-zd';
    }
    else if (!post.isApproved && !post.sanitizedHtml) {
      headerElem = r.div({ className: 'dw-p-hd' }, 'Hidden comment pending approval, posted ',
            moment(post.createdAt).from(this.props.now), '.');
      extraClasses += ' dw-p-unapproved';
    }
    else {
      if (!post.isApproved) {
        var the = post.authorId === user.userId ? 'Your' : 'The';
        pendingApprovalElem = r.div({ className: 'dw-p-pending-mod',
            onClick: this.onUncollapseClick }, the, ' comment below is pending approval.');
      }
      var headerProps = _.clone(this.props);
      headerProps.onMarkClick = this.onMarkClick;
      headerElem = PostHeader(headerProps);
      bodyElem = PostBody(this.props);
    }

    var wrongWarning;
    if (post.numWrongVotes >= 2 && !this.props.abbreviate) {
      var wrongness = post.numWrongVotes / (post.numLikeVotes || 1);
      // One, two, three, many.
      if (post.numWrongVotes > 3 && wrongness > 1) {
        wrongWarning =
          r.div({ className: 'dw-wrong dw-very-wrong icon-warning' },
            'Many think this comment is wrong:');
      }
      else if (wrongness > 0.33) {
        wrongWarning =
          r.div({ className: 'dw-wrong icon-warning' },
            'Some think this comment is wrong:');
      }
    }

    // For non-multireplies, we never show "In response to" for the very first reply (index 0),
    // instead we draw an arrow.
    var replyReceivers;
    if (!this.props.abbreviate && (this.props.index > 0 || post.multireplyPostIds.length)) {
      replyReceivers = ReplyReceivers({ post: post, allPosts: this.props.allPosts });
    }

    var mark = user.marksByPostId[post.postId];
    switch (mark) {
      case YellowStarMark: extraClasses += ' dw-p-mark-yellow-star'; break;
      case BlueStarMark: extraClasses += ' dw-p-mark-blue-star'; break;
      case ManualReadMark: extraClasses += ' dw-p-mark-read'; break;
      default:
        // Don't add the below class before user specific data has been activated, otherwise
        // all posts would show a big black unread mark on page load, which looks weird.
        if (this.props.userSpecificDataAdded) {
          var autoRead = user.postIdsAutoReadLongAgo.indexOf(post.postId) !== -1;
          autoRead = autoRead || user.postIdsAutoReadNow.indexOf(post.postId) !== -1;
          if (!autoRead) {
            extraClasses += ' dw-p-unread';
          }
        }
    }

    var id = this.props.abbreviate ? undefined : 'post-' + post.postId;

    return (
      r.div({ className: 'dw-p ' + extraClasses, id: id,
            onMouseEnter: this.props.onMouseEnter, onClick: this.onClick },
        pendingApprovalElem,
        wrongWarning,
        replyReceivers,
        headerElem,
        bodyElem));
  }
});



var ReplyReceivers = createComponent({
  render: function() {
    var multireplyClass = ' dw-mrrs'; // mrrs = multi reply receivers
    var thisPost: Post = this.props.post;
    var repliedToPostIds = thisPost.multireplyPostIds;
    if (!repliedToPostIds || !repliedToPostIds.length) {
      multireplyClass = '';
      repliedToPostIds = [thisPost.parentId];
    }
    var receivers = repliedToPostIds.map((repliedToPostId, index) => {
      var post = this.props.allPosts[repliedToPostId];
      if (!post)
        return r.i({}, '?someone unknown?');

      var link =
        r.a({ href: '#post-' + post.postId, className: 'dw-rr' }, // rr = reply receiver
          post.authorUsername || post.authorFullName);

      return index === 0 ? link : r.span({}, ' and', link);
    });
    return (
      r.div({ className: 'dw-rrs' + multireplyClass }, // rrs = reply receivers
        'In reply to', receivers, ':'));
  }
});



var PostHeader = createComponent({
  onUserClick: function(event) {
    debiki2.pagedialogs.aboutUserDialog.open(this.props.post);
    event.preventDefault();
  },

  copyPermalink: function() {
    var hash = '#post-' + this.props.post.postId;
    var url = window.location.host + '/-' + debiki.getPageId() + hash;
    window.prompt('To copy permalink, press Ctrl+C then Enter', url);
  },

  render: function() {
    var post = this.props.post;
    if (!post)
      return r.p({}, '(Post header missing [DwE7IKW2])');

    var user: User = this.props.user;
    var linkFn = this.props.abbreviate ? 'span' : 'a';

    var authorUrl = '/-/users/#/id/' + post.authorId;
    var authorNameElems;
    if (post.authorFullName && post.authorUsername) {
      authorNameElems = [
        r.span({ className: 'dw-username' }, post.authorUsername),
        r.span({ className: 'dw-fullname' }, ' (' + post.authorFullName + ')')];
    }
    else if (post.authorFullName) {
      authorNameElems = [
          r.span({ className: 'dw-fullname' }, post.authorFullName),
          r.span({ className: 'dw-lg-t-spl' }, '?')]; // {if (user.email isEmpty) "??" else "?"
        /* Could add back tooltip:
          '<b>??</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' and not specified any email address.'

          '<b>?</b> means that the user has not logged in,'+
          ' so <i>anyone</i> can pretend to be this user&nbsp;(!),'+
          ' but has specified an email address.'
        */
    }
    else if (post.authorUsername) {
      authorNameElems = r.span({ className: 'dw-username' }, post.authorUsername);
    }
    else {
      authorNameElems = r.span({}, '(Unknown author)');
    }

    var createdAt = moment(post.createdAt).from(this.props.now);

    var editInfo = null;
    if (post.lastApprovedEditAt) {
      var editedAt = moment(post.lastApprovedEditAt).from(this.props.now);
      var byVariousPeople = post.numEditors > 1 ? ' by various people' : null;
      editInfo =
        r.span({}, ', edited ', editedAt, byVariousPeople);
    }

    var voteCounts = this.props.abbreviate === 'Much' ? null : voteCountsToText(post);

    var anyPin;
    if (post.pinnedPosition) {
      anyPin =
        r[linkFn]({ className: 'dw-p-pin icon-pin' });
    }

    var postId;
    var anyMark;
    if (post.postId !== TitleId && post.postId !== BodyPostId) {
      postId = r[linkFn]({ className: 'dw-p-link', onClick: this.copyPermalink },
          '#' + post.postId);
      /* Doesn't work, the tooltip gets placed far away to the left. You'll find it
         in Dev Tools like so: $('.tooltip-inner').
      if (!this.props.abbreviate) {
        postId = OverlayTrigger({ placement: 'left',
        overlay: Tooltip({}, 'Click to copy permalink') }, postId);
      }
      */

      var mark = user.marksByPostId[post.postId];
      var starClass = ' icon-star';
      if (mark === ManualReadMark) {
        starClass = ' icon-star-empty';
      }
      // The outer -click makes the click area larger, because the marks are small.
      anyMark =
          r.span({ className: 'dw-p-mark-click', onClick: this.props.onMarkClick },
            r.span({ className: 'dw-p-mark icon-star' + starClass }));
    }

    var by = post.postId === BodyPostId ? 'By ' : '';
    var isBodyPostClass = post.postId === BodyPostId ? ' dw-ar-p-hd' : '';
    var suspendedClass = post.authorSuspendedTill ? ' dw-suspended' : '';

    var userLinkProps: any = {
      className: 'dw-p-by' + suspendedClass,
      onClick: this.onUserClick,
      href: authorUrl
    };

    if (post.authorSuspendedTill === 'Forever') {
      userLinkProps.title = 'User banned';
    }
    else if (post.authorSuspendedTill) {
      userLinkProps.title = 'User suspended until ' +
          moment(post.authorSuspendedTill).format('YYYY-MM-DD')
    }

    return (
        r.div({ className: 'dw-p-hd' + isBodyPostClass },
          anyPin,
          postId,
          anyMark,
          by,
          r[linkFn](userLinkProps, authorNameElems),
          createdAt,
          editInfo, '. ',
          voteCounts));
  }
});


function voteCountsToText(post) {
  var text = '';
  function numPeople(num) {
    if (text) {
      return num + ' ';
    }
    else {
      return num > 1 ? num + ' people ' : num + ' person ';
    }
  }
  function thisComment() {
    return text ? ' it ' : ' this comment ';
  }
  if (post.numLikeVotes && post.postId !== BodyPostId) {
    text += numPeople(post.numLikeVotes) +
      (post.numWrongVotes == 1 ? 'likes' : 'like') + ' this comment';
  }
  if (post.numWrongVotes) {
    if (text) text += ', ';
    text += numPeople(post.numWrongVotes) +
      (post.numWrongVotes == 1 ? 'thinks' : 'think') + thisComment() + 'is wrong';
  }
  if (post.numOffTopicVotes) {
    if (text) text += ', ';
    text += numPeople(post.numOffTopicVotes) +
        (post.numOffTopicVotes == 1 ? 'thinks' : 'think') + thisComment() + 'is off-topic';
  }
  if (text) text += '.';
  return text;
}


var PostBody = createComponent({
  render: function() {
    var post = this.props.post;
    var body;
    if (this.props.abbreviate) {
      this.textDiv = this.textDiv || $('<div></div>');
      this.textDiv.html(post.sanitizedHtml);
      var length = Math.min(screen.width, screen.height) < 500 ? 100 : 150;
      if (screen.height < 300) {
        length = 60;
      }
      var startOfText = this.textDiv.text().substr(0, length);
      if (startOfText.length === length) {
        startOfText += '....';
      }
      body = r.div({ className: 'dw-p-bd-blk' }, startOfText);
    }
    else {
      body = r.div({ className: 'dw-p-bd-blk',
          dangerouslySetInnerHTML: { __html: post.sanitizedHtml }});
    }
    return (
      r.div({ className: 'dw-p-bd' }, body));
  }
});


var NoCommentsPageActions = createComponent({
  onEditClick: function(event) {
    debiki.internal.$showEditForm.call(event.target, event);
  },
  render: function() {
    var user: User = this.props.user;
    var post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    var actions = [];
    if (user.isAdmin) {
      actions.push(
        r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit'));
    }

    return (
      r.div({ className: 'dw-p-as dw-as', onMouseEnter: this.showActions },
        actions));
  }
});


var PostActions = createComponent({
  showActions: function() {
    debiki.internal.showPostActions(this.getDOMNode());
  },
  onReplyClick: function(event) {
    debiki.internal.$showReplyForm.call(event.target, event);
  },
  onEditClick: function(event) {
    debiki.internal.$showEditForm.call(event.target, event);
  },
  onLikeClick: function(event) {
    debiki.internal.$toggleVote('VoteLike').call(event.target, event);
  },
  onWrongClick: function(event) {
    debiki.internal.$toggleVote('VoteWrong').call(event.target, event);
  },
  onOffTopicClick: function(event) {
    debiki.internal.$toggleVote('VoteOffTopic').call(event.target, event);
  },
  onEditSuggestionsClick: function(event) {
    debiki.internal.$showEditsDialog.call(event.target, event);
  },
  onFlagClick: function(event) {
    debiki2.flagDialog.open(this.props.post.postId);
  },
  onDeleteClick: function(event) {
    debiki.internal.$showDeleteForm.call(event.target, event);
  },
  onCollapsePostClick: function(event) {
    debiki.internal.$showActionDialog('CollapsePost').call(event.target, event);
  },
  onCollapseTreeClick: function(event) {
    debiki.internal.$showActionDialog('CollapseTree').call(event.target, event);
  },
  onCloseTreeClick: function(event) {
    debiki.internal.$showActionDialog('CloseTree').call(event.target, event);
  },
  onPinClick: function(event) {
    debiki.internal.$showActionDialog('PinTree').call(event.target, event);
  },

  render: function() {
    var post = this.props.post;

    if (!post.isApproved && !post.text)
      return null;

    var user = this.props.user;
    var isOwnPost = post.authorId === user.userId;
    var votes = user.votes[post.postId] || [];

    var deletedOrCollapsed =
      post.isPostDeleted || post.isTreeDeleted || post.isPostCollapsed || post.isTreeCollapsed;

    var replyLikeWrongLinks = null;
    if (!deletedOrCollapsed) {
      // They float right, so they're placed in reverse order.
      var myLikeVote = votes.indexOf('VoteLike') !== -1 ? ' dw-my-vote' : ''
      var myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : ''

      replyLikeWrongLinks = [
          r.a({ className: 'dw-a dw-a-wrong icon-warning' + myWrongVote,
            title: 'Click if you think this post is wrong', onClick: this.onWrongClick },
            'Wrong')];

      if (isOwnPost) {
        replyLikeWrongLinks.push(
          r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit'));
      }
      else {
        replyLikeWrongLinks.push(
          r.a({ className: 'dw-a dw-a-like icon-heart' + myLikeVote,
            title: 'Like this', onClick: this.onLikeClick }, 'Like'));
      }

      replyLikeWrongLinks.push(
        r.a({ className: 'dw-a dw-a-reply icon-reply', onClick: this.onReplyClick }, 'Reply'));
    }

    var moreLinks = [];

    var myOffTopicVote = votes.indexOf('VoteOffTopic') !== -1 ? ' dw-my-vote' : ''
    moreLinks.push(
        r.a({ className: 'dw-a dw-a-offtopic icon-split' + myOffTopicVote,
            title: 'Click if you think this post is off-topic', onClick: this.onOffTopicClick },
          'Off-Topic'));

    if (!isOwnPost) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit'));
    }

    moreLinks.push(
        r.a({ className: 'dw-a dw-a-flag icon-flag', onClick: this.onFlagClick }, 'Report'));

    if (user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-pin icon-pin', onClick: this.onPinClick }, 'Pin'));

    var suggestionsOld = [];
    var suggestionsNew = [];

    if (post.numPendingEditSuggestions > 0)
      suggestionsNew.push(
          r.a({ className: 'dw-a dw-a-edit-suggs icon-edit dw-a-pending-review',
           title: 'View edit suggestions', onClick: this.onEditSuggestionsClick },
            '×', post.numPendingEditSuggestions));

    // TODO [react]
    // suggestionsNew.push(renderUncollapseSuggestions(post))

    if (!post.isPostCollapsed && post.numCollapsePostVotesPro > 0 && false)
      suggestionsNew.push(
        r.a({ className:'dw-a dw-a-collapse-suggs icon-collapse-post dw-a-pending-review',
          title: 'Vote for or against collapsing this comment' }, '×',
            post.numCollapsePostVotesPro, '–', post.numCollapsePostVotesCon));

    if (!post.isTreeCollapsed && post.numCollapseTreeVotesPro > 0 && false)
      suggestionsNew.push(
        r.a({ className: 'dw-a dw-a-collapse-suggs icon-collapse-tree dw-a-pending-review',
          title: 'Vote for or against collapsing this whole thread' }, '×',
            post.numCollapseTreeVotesPro, '–', post.numCollapseTreeVotesCon));

    // People should upvote any already existing suggestion, not create
    // new ones, so don't include any action link for creating a new suggestion,
    // if there is one already. Instead, show a link you can click to upvote
    // the existing suggestion:

    if (!post.isTreeCollapsed && !post.numCollapseTreeVotesPro && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-collapse-tree icon-collapse',
            onClick: this.onCollapseTreeClick }, 'Collapse tree'));

    if (!post.isPostCollapsed && !post.numCollapsePostVotesPro && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-collapse-post icon-collapse',
            onClick: this.onCollapsePostClick }, 'Collapse post'));

    if (post.isTreeCollapsed && !post.numUncollapseTreeVotesPro && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-uncollapse-tree' }, 'Uncollapse tree'));

    if (post.isPostCollapsed && !post.numUncollapsePostVotesPro && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-uncollapse-post' }, 'Uncollapse post'));

    // ----- Close links

    if (post.isTreeClosed && user.isAdmin) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-reopen-tree' }, 'Reopen'));
    }
    else if (user.isAdmin) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-close-tree icon-archive',
            onClick: this.onCloseTreeClick }, 'Close'));
    }

    // ----- Move links

    // ? <a class="dw-a dw-a-move">Move</a>

    // ----- Delete links

    if (!post.isPostDeleted && post.numDeletePostVotesPro > 0 && false) {
      suggestionsNew.push(
        r.a({ className: 'dw-a dw-a-delete-suggs icon-delete-post dw-a-pending-review',
          title: 'Vote for or against deleting this comment' }, '×',
            post.numDeletePostVotesPro, '–', post.numDeletePostVotesCon));
    }

    if (!post.isTreeDeleted && post.numDeleteTreeVotesPro > 0 && false) {
      suggestionsNew.push(
        r.a({ className: 'dw-a dw-a-delete-suggs icon-delete-tree dw-a-pending-review',
          title: 'Vote for or against deleting this whole thread' }, '×',
            post.numDeleteTreeVotesPro, '–', post.numDeleteTreeVotesCon));
    }

    if ((!post.numDeleteTreeVotesPro || !post.numDeletePostVotesPro)  && user.isAdmin) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-delete icon-trash', onClick: this.onDeleteClick }, 'Delete'));
    }

    var moreDropdown =
      r.span({ className: 'dropdown navbar-right' },
        r.a({ className: 'dw-a dw-a-more', 'data-toggle': 'dropdown' }, 'More'),
        r.div({ className: 'dropdown-menu dropdown-menu-right dw-p-as-more' },
          moreLinks));

    return (
      r.div({ className: 'dw-p-as dw-as', onMouseEnter: this.showActions,
          onClick: this.props.onClick },
        suggestionsNew,
        suggestionsOld,
        moreDropdown,
        replyLikeWrongLinks));
  }
});


function horizontalCss(horizontal) {
    return horizontal ? ' dw-hz' : '';
}


function isCollapsed(post) {
  return post.isTreeCollapsed || post.isPostCollapsed;
}


function isDeleted(post) {
  return !post || post.isTreeDeleted || post.isPostDeleted;
}



function authorIsGuest(post) {
  // Guest ids currently start with '-'.
  return post.authorId && post.authorId.length >= 1 && post.authorId[0] === '-';
}


function renderTitleBodyComments() {
  var root = document.getElementById('dwPosts');
  if (!root)
    return;

  var store = debiki2.ReactStore.allData();
  if (store.pageRole === 'Forum') {
    var router = ReactRouter.create({
      routes: debiki2.renderer.buildForumRoutes(),
      scrollBehavior: debiki2.renderer.ForumScrollBehavior,
    });
    router.run(function(handler) {
      React.render(handler(store), root);
    });
  }
  else {
    React.render(PageWithState(), root);
  }
}


function renderTitleBodyCommentsToString() {
  var store = debiki2.ReactStore.allData();
  if (store.pageRole === 'Forum') {
    var routes = debiki2.renderer.buildForumRoutes();
    var result;
    // In the future, when using the HTML5 history API to update the URL when navigating
    // inside the forum, we can use `store.pagePath` below. But for now, when using
    // the hash fragment, start at #/latest/ (the default route) always:
    var pagePath = '/latest/';
    ReactRouter.run(routes, pagePath, function(handler) {
      result = React.renderToString(handler(store));
    });
    return result;
  }
  else {
    return React.renderToString(Page(store));
  }
}

//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
