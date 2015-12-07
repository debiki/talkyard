/*
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg
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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../dialogs.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../editor/title-editor.ts" />
/// <reference path="../edit-history/edit-history-dialog.ts" />
/// <reference path="../react-elements/topbar.ts" />
/// <reference path="../page-dialogs/wikify-dialog.ts" />
/// <reference path="../page-dialogs/delete-post-dialog.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../model.ts" />

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

var NoPostId = -1; // also in editor.ts
var MaxGuestId = -2; // place where?
function isGuest(user: CompleteUser) {
  return user.id <= MaxGuestId;
}
function isStaff(user: User) {
  return user.isAdmin || user.isModerator;
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
    return (
      r.div({ className: 'container' },
        debiki2.reactelements.TopBar({}),
        r.article({},
          TitleBodyComments(this.props))));
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

  makeHelpMessage: function() {
    var store: Store = this.props;
    var user: User = store.user;
    var bodyPost = store.allPosts[BodyId];

    if (store.pageAnsweredAtMs)
      return null; // or?: "This is a question with an accepted answer. You can click the (x) to
                  // go directly to the accepted answer.

    if (store.pagePlannedAtMs)
      return null; // or?: "This is in progress or has been planned. The [ ] icon is
                   // a todo list checkbox item that hasn't been checked yet

    if (store.pageDoneAtMs)
      return null; // or?: "Then thing(s) described on this page has been done. That's the
                   // reason the [x] icon is shonw in front of the title.

    if (store.pageClosedAtMs) {
      var closedIcon = r.span({ className: 'icon-cancel-circled-empty' });
      if (store.pageRole === PageRole.Critique) {  // [plugin]
        return { id: 'EdH4KDPU2', version: 1, content: r.span({},
            "This topic has been ", closedIcon, " closed. People won't get any additional " +
            "credits for posting more critique here.") };
      }
      else {
        return { id: 'EdH7UMPW', version: 1, content: r.div({},
            "This topic has been ", closedIcon, " closed. You can still post comments, " +
            "but that won't make this topic bump to the top of the latest-topics list.") };
      }
    }

    if (store.pageLockedAtMs)
      return null; // or ...

    if (store.pageFrozenAtMs)
      return null; // or ...

    if (store.pageRole === PageRole.Critique) {  // [plugin]
      if (!user.isAuthenticated) {
        // Could explain: here someone has asked for critique. X people have answered,
        // see the Replies section below. And there are Y chat comments or status updates.
        return null;
      }
      else {
        var isPageAuthor = bodyPost.authorIdInt === user.userId;
        if (isPageAuthor) {
          if (store.numPostsRepliesSection) {
            return { id: 'EdH5GUF2', version: 1, content: r.span({},
                "You have been given critique — see the Replies section below.") };
          }
          else {
            return { id: 'EdH0SE2W', version: 1, content: r.div({},
                r.p({}, "Now you have asked for critique. You'll be notified via email later " +
                  "when you get critique."),
                r.p({},
                  "If you want to proofread and edit your text below, to make sure it asks for " +
                  "the right things and is easy to understand, then, to edit it, " +
                  "click the edit icon (", r.span({ className: 'icon-edit' }),
                  ") just below your post.")) };
          }
        }
        else {
          return { id: 'EdH7YM21', version: 1, content: r.span({},
            "Click ", r.b({}, "Give Critique"), " below, to critique this — then you'll " +
            "get credits, which you can use to ask for critique yourself.") };
        }
      }
    }

    return null;
  },

  render: function() {
    var categories;
    var props: Store = this.props;
    var user: User = props.user;
    if (props.ancestorsRootFirst.length) {
      var hide = _.some(props.ancestorsRootFirst, a => a.hideInForum);
      categories = hide ? null :
        r.ol({ className: 'parent-forums-list' },
          props.ancestorsRootFirst.map((ancestor: Ancestor) => {
            return r.li({ key: ancestor.categoryId }, r.a({ href: ancestor.path }, ancestor.title));
          }));
    }

    var anyHelpMessage = this.makeHelpMessage();
    anyHelpMessage = anyHelpMessage
        ? debiki2.help.HelpMessageBox({ message: anyHelpMessage })
        : null;

    var anyAboutCategoryClass;
    var anyAboutCategoryTitle;
    if (props.pageRole === PageRole.About) {
      anyAboutCategoryClass = 'dw-about-category';
      anyAboutCategoryTitle =
          r.h2({ className: 'dw-about-cat-ttl-prfx' }, "About category:")
    }

    var anyTitle = null;
    var pageRole: PageRole = props.pageRole;
    if (pageRole === PageRole.HomePage || pageRole === PageRole.EmbeddedComments ||
        props.rootPostId !== BodyPostId) {
      // Show no title for the homepage — it should have its own custom HTML with
      // a title and other things.
      // Embedded comment pages have no title, only comments.
      // And show no title if we're showing a comment not the article as the root post.
    }
    else {
      anyTitle = Title(props);
    }

    var anyPostHeader = null;
    var anySocialLinks = null;
    if (pageRole === PageRole.HomePage || pageRole === PageRole.Forum ||
        pageRole === PageRole.About || // pageRole === PageRole.WikiMainPage ||
        pageRole === PageRole.SpecialContent || pageRole === PageRole.Blog ||
        pageRole === PageRole.EmbeddedComments ||
        props.rootPostId !== BodyPostId) {
      // Show no author name or social links for these generic pages.
      // And show nothing if we're showing a comment not the article as the root post.
    }
    else {
      var post = props.allPosts[props.rootPostId];
      anyPostHeader = PostHeader({ post: post });
      anySocialLinks = SocialLinks({ socialLinksHtml: props.socialLinksHtml });
    }

    var embeddedClass = props.isInEmbeddedCommentsIframe ? ' dw-embedded' : '';

    return (
      r.div({ className: anyAboutCategoryClass },
        categories,
        anyHelpMessage,
        anyAboutCategoryTitle,
        r.div({ className: 'debiki dw-page' + embeddedClass },
          anyTitle,
          anyPostHeader,
          anySocialLinks,
          RootPostAndComments(props))));
  },
});


var Title = createComponent({
  getInitialState: function() {
    return { isEditing: false };
  },

  scrollToAnswer: function() {
    debiki2.ReactActions.loadAndShowPost(this.props.pageAnswerPostNr);
    debiki2['postnavigation'].addVisitedPosts(TitleId, this.props.pageAnswerPostNr);
  },

  editTitle: function(event) {
    this.setState({ isEditing: true });
  },

  closeEditor: function() {
    this.setState({ isEditing: false });
  },

  cycleIsDone: function() {
    debiki2.ReactActions.cyclePageDone();
  },

  render: function() {
    var store: Store = this.props;
    var user = this.props.user;
    var titlePost = this.props.allPosts[TitleId];
    if (!titlePost)
      return null;

    var titleText = titlePost.isApproved
        ? titlePost.sanitizedHtml
        : r.i({}, '(Title pending approval)');

    var anyShowForumInroBtn;
    if (!this.props.hideButtons && store.pageRole === PageRole.Forum && store.hideForumIntro) {
      var introPost = store.allPosts[BodyId];
      if (introPost && !introPost.isPostHidden) {
        anyShowForumInroBtn =
          r.a({ className: 'icon-info-circled dw-forum-intro-show',
              onClick: () => debiki2['ReactActions'].showForumIntro(true) });
      }
    }

    var anyEditTitleBtn;
    if (!this.props.hideButtons && (isStaff(user) || user.userId === titlePost.authorId)) {
      anyEditTitleBtn =
        r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.editTitle });
    }

    var contents;
    if (this.state.isEditing) {
      var editorProps = _.clone(this.props);
      editorProps.closeEditor = this.closeEditor;
      contents = debiki2.titleeditor.TitleEditor(editorProps);
    }
    else {
      var pinClass = this.props.pinWhere ? ' icon-pin' : '';
      var tooltip;
      var icon;
      // (Some dupl code, see PostActions below and isDone() and isAnswered() in forum.ts [4KEPW2]
      if (store.pageClosedAtMs && !store.pageDoneAtMs && !store.pageAnsweredAtMs) {
        icon = r.span({ className: 'icon-cancel-circled-empty' });
        tooltip = makePageClosedTooltipText(store.pageRole) + '\n';
      }
      else if (store.pageRole === PageRole.Question) {
        var icon = store.pageAnsweredAtMs
            ? r.a({ className: 'icon-ok-circled-empty dw-clickable', onClick: this.scrollToAnswer })
            : r.span({ className: 'icon-help-circled' });;
        tooltip = makeQuestionTooltipText(store.pageAnsweredAtMs) + ".\n";
      }
      else if (store.pageRole === PageRole.Problem || store.pageRole === PageRole.Idea ||
                store.pageRole === PageRole.ToDo) {
        // (Some dupl code, see [5KEFEW2] in forum.ts.
        var iconClass;
        var iconTooltip;
        if (store.pageRole === PageRole.Problem || store.pageRole === PageRole.Idea) {
          if (!store.pagePlannedAtMs) {
            tooltip = store.pageRole === PageRole.Problem
                ? "This is a new problem"
                : "This is a new idea";
            iconClass = store.pageRole === PageRole.Problem ?
                'icon-attention-circled' : 'icon-idea';
            iconTooltip = "Click to change status to planned";
          }
          else if (!store.pageDoneAtMs) {
            tooltip = store.pageRole === PageRole.Problem
                ? "We're planning to fix this"
                : "We're planning to implement this";
            iconClass = 'icon-check-empty';
            iconTooltip = "Click to mark as done";
          }
          else {
            tooltip = store.pageRole === PageRole.Problem
                ? "This has been fixed"
                : "This has been done";
            iconClass = 'icon-check';
            iconTooltip = "Click to change status to new";
          }
        }
        else {
          tooltip = store.pageDoneAtMs
              ? "This has been done or fixed.\n"
              : "This is about something to do or fix.\n";
          iconClass = store.pageDoneAtMs ? 'icon-check' : 'icon-check-empty';
          iconTooltip = store.pageDoneAtMs
              ? "Click to change status to not-yet-done"
              : "Click to mark as done";
        }
        if (!isStaff(store.user)) iconTooltip = null;
        var clickableClass = isStaff(store.user) ? ' dw-clickable' : '';
        var onClick = isStaff(store.user) ? this.cycleIsDone : null;
        icon = r.span({ className: iconClass + clickableClass, onClick: onClick,
            title: iconTooltip });
      }
      else if (store.pageRole === PageRole.ToDo) {
        var clickableClass = isStaff(store.user) ? ' dw-clickable' : '';
        var onClick = isStaff(store.user) ? this.cycleIsDone : null;
        icon = r.span({ className: iconClass + clickableClass, onClick: onClick,
            title: iconTooltip });
      }
      switch (this.props.pinWhere) {
        case PinPageWhere.Globally: tooltip += "Pinned globally."; break;
        case PinPageWhere.InCategory: tooltip += "Pinned in this category."; break;
        default: ;
      }
      contents =
          r.div({ className: 'dw-p-bd' },
            r.div({ className: 'dw-p-bd-blk' },
              r.h1({ className: 'dw-p-ttl' + pinClass, title: tooltip },
                icon, titleText, anyShowForumInroBtn, anyEditTitleBtn)));
    }
    return (
      r.div({ className: 'dw-t', id: 'dw-t-0' },
        r.div({ className: 'dw-p dw-p-ttl', id: 'post-0' },
          contents)));
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
  getInitialState: function() {
    return { showClickReplyInstead: false };
  },

  onChatReplyClick: function() {
    // Unless shown alraedy, or read already, show a tips about clicking "Reply" instead.
    var hasReadClickReplyTips = debiki2.help.isHelpMessageClosed(this.props, clickReplyInsteadHelpMessage);
    if (hasReadClickReplyTips || this.state.showClickReplyInstead) {
      debiki.internal.showReplyFormForFlatChat();
    }
    else {
      this.setState({ showClickReplyInstead: true });
    }
  },

  render: function() {
    var store: Store = this.props;
    var allPosts: { [postId: number]: Post; } = this.props.allPosts;
    var user = this.props.user;
    var rootPost = allPosts[this.props.rootPostId];
    if (!rootPost)
      return r.p({}, '(Root post missing, id: ' + this.props.rootPostId +
          ', these are present: ' + _.keys(allPosts) + ' [DwE8WVP4])');
    var isBody = this.props.rootPostId === BodyPostId;
    var pageRole: PageRole = this.props.pageRole;
    var threadClass = 'dw-t dw-depth-0' + horizontalCss(this.props.horizontalLayout);
    var postIdAttr = 'post-' + rootPost.postId;
    var postClass = 'dw-p';
    var postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t';
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    var showComments = pageRole !== PageRole.HomePage && pageRole !== PageRole.Forum &&
        pageRole !== PageRole.Blog &&
        pageRole !== PageRole.SpecialContent; // && pageRole !== PageRole.WikiMainPage

    var sanitizedHtml = rootPost.isApproved
        ? rootPost.sanitizedHtml
        : '<p>(Text pending approval.)</p>';

    var body = null;
    if (pageRole !== PageRole.EmbeddedComments) {
      body =
        r.div({ className: postClass, id: postIdAttr },
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

    var solvedBy;
    if (store.pageRole === PageRole.Question && store.pageAnsweredAtMs) {
      // onClick:... handled in ../utils/show-and-highlight.js currently (scrolls to solution).
      solvedBy = r.a({ className: 'dw-solved-by icon-ok-circled',
          href: '#post-' + store.pageAnswerPostNr },
        "Solved in post #" + store.pageAnswerPostNr);
    }

    var anyHorizontalArrowToChildren = null;
    if (this.props.horizontalLayout) {
      anyHorizontalArrowToChildren =
          debiki2.renderer.drawHorizontalArrowFromRootPost(rootPost);
    }

    var childIds = pageRole === PageRole.EmbeddedComments ?
        this.props.topLevelCommentIdsSorted : rootPost.childIdsSorted;

    var isSquashing = false;

    var threadedChildren = childIds.map((childId, childIndex) => {
      var child = allPosts[childId];
      if (!child)
        return null; // deleted
      if (isSquashing && child.squash)
        return null;
      if (child.postType === PostType.Flat)
        return null;
      isSquashing = false;
      var threadProps = _.clone(this.props);
      threadProps.elemType = 'div';
      threadProps.postId = childId;
      threadProps.index = childIndex;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      threadProps.is2dTreeColumn = this.props.horizontalLayout;
      if (child.squash) {
        isSquashing = true;
        return (
          r.li({ key: childId },
            SquashedThreads(threadProps)));
      }
      else {
        return (
          r.li({ key: childId },
            Thread(threadProps)));
      }
    });

    var flatComments = [];
    _.each(store.allPosts, (child: Post, childId) => {
      if (!child || child.postType !== PostType.Flat)
        return null;
      var threadProps = _.clone(this.props);
      threadProps.elemType = 'div';
      threadProps.postId = childId;
      // The index is used for drawing arrows but here there'll be no arrows.
      threadProps.index = null;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      flatComments.push(
        r.li({ key: childId },
          Thread(threadProps)));
    });

    var anyClickReplyInsteadHelpMessage = this.state.showClickReplyInstead
        ? debiki2.help.HelpMessageBox({ large: true, message: clickReplyInsteadHelpMessage })
        : null;

    return (
      r.div({ className: threadClass },
        body,
        solvedBy,
        PostActions({ store: this.props, post: rootPost }),
        debiki2.reactelements.CommentsToolbar(),
        anyHorizontalArrowToChildren,
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            threadedChildren)),

        r.div({ className: 'dw-chat-title', id: 'dw-chat' },
          store.numPostsChatSection + " chat comments"),
        r.div({ className: 'dw-vt' },
          r.div({ className: 'dw-chat dw-single-and-multireplies' },
            r.ol({ className: 'dw-res dw-singlereplies' },
              flatComments))),

        anyClickReplyInsteadHelpMessage,
        r.div({ className: 'dw-chat-as' },
          r.a({ className: 'dw-a dw-a-reply icon-comment-empty', onClick: this.onChatReplyClick,
              title: "Add a chat comment if you want to talk lightly and casually " +
                "with others about this topic.\nHowever, if you want to reply to the " +
                "Original Post (at the top of the page), then instead click Reply just below " +
                "that post." },
            " Add chat comment")),

        r.div({ id: 'dw-the-end', style: { clear: 'both' } })));
  },
});


var clickReplyInsteadHelpMessage = {
  id: 'EsH5UGPM2',
  version: 1,
  okayText: "Okay",
  content: r.span({},
    r.b({}, "If you want to reply to someone"), ", then instead click ",
    r.span({ className: 'icon-reply', style: { margin: '0 1ex' }}, "Reply"),
    " just below his/her post.")
};


var SquashedThreads = createComponent({
  onClick: function() {
    debiki2.ReactActions.unsquashTrees(this.props.postId);
  },

  render: function() {
    var allPosts: { [postId: number]: Post; } = this.props.allPosts;
    var post = allPosts[this.props.postId];
    var parentPost = allPosts[post.parentId];

    var arrows = debiki2.renderer.drawArrowsFromParent(
      allPosts, parentPost, this.props.depth, this.props.index,
      this.props.horizontalLayout, this.props.rootPostId);

    var baseElem = r[this.props.elemType];
    var depthClass = ' dw-depth-' + this.props.depth;
    var indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    var is2dColumnClass = this.props.is2dTreeColumn ? ' dw-2dcol' : '';
    var postIdDebug = debiki.debug ? '  #' + post.postId : '';

    return (
      baseElem({ className: 'dw-t dw-ts-squashed' + depthClass + indentationDepthClass +
          is2dColumnClass },
        arrows,
        r.a({ className: 'dw-x-show', onClick: this.onClick },
          "Click to show more replies" + postIdDebug)));
  }
});


var Thread = createComponent({
  shouldComponentUpdate: function(nextProps, nextState) {
    var should = !nextProps.quickUpdate || !!nextProps.postsToUpdate[this.props.postId];
    return should;
  },

  onAnyActionClick: function() {
    this.refs.post.onAnyActionClick();
  },

  render: function() {
    var allPosts: { [postId: number]: Post; } = this.props.allPosts;
    var post: Post = allPosts[this.props.postId];
    if (!post) {
      // This tree has been deleted.
      return null;
    }

    var parentPost = allPosts[post.parentId];
    var deeper = this.props.depth + 1;
    var isFlat = post.postType === PostType.Flat;

    // Draw arrows, but not to multireplies, because we don't know if they reply to `post`
    // or to other posts deeper in the thread.
    var arrows = [];
    if (!post.multireplyPostIds.length && !isFlat) {
      arrows = debiki2.renderer.drawArrowsFromParent(
        allPosts, parentPost, this.props.depth, this.props.index,
        this.props.horizontalLayout, this.props.rootPostId);
    }

    var numDeletedChildren = 0;
    for (var i = 0; i < post.childIdsSorted.length; ++i) {
      var childId = post.childIdsSorted[i];
      if (!allPosts[childId]) {
        numDeletedChildren += 1;
      }
    }

    var isSquashingChildren = false;

    var children = [];
    if (!post.isTreeCollapsed && !post.isTreeDeleted && !isFlat) {
      children = post.childIdsSorted.map((childId, childIndex) => {
        var child = allPosts[childId];
        if (!child)
          return null; // deleted
        if (isSquashingChildren && child.squash)
          return null;
        if (child.postType === PostType.Flat)
          return null;
        isSquashingChildren = false;

        var childIndentationDepth = this.props.indentationDepth;
        // All children except for the last one are indented.
        var isIndented = childIndex < post.childIdsSorted.length - 1 - numDeletedChildren;
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
        threadProps.is2dTreeColumn = false;
        threadProps.key = childId;
        if (child.squash) {
          isSquashingChildren = true;
          return (
            SquashedThreads(threadProps));
        }
        else {
          return (
            Thread(threadProps));
        }
      });
    }

    var actions = isCollapsed(post)
      ? null
      : PostActions({ store: this.props, post: post,
          onClick: this.onAnyActionClick });

    var renderCollapsed = (post.isTreeCollapsed || post.isPostCollapsed) &&
        // Don't collapse threads in the sidebar; there, comments are abbreviated
        // and rendered in a flat list.
        !this.props.abbreviate;

    var showAvatar = !renderCollapsed && this.props.depth === 1 && !this.props.is2dTreeColumn;
    var anyAvatar = !showAvatar ? null : debiki2.avatar.Avatar({
      // For now: — later, replace authorUsername etc with a { id, username, fullName } object?
      user: {
        id: post.authorId,
        username: post.authorUsername,
        fullName: post.authorFullName,
        avatarUrl: post.authorAvatarUrl,
      }
    });
    var avatarClass = showAvatar ? ' ed-w-avtr' : '';

    var postProps = _.clone(this.props);
    postProps.post = post;
    postProps.index = this.props.index;
    //postProps.onMouseEnter = this.onPostMouseEnter; -- but there's no onPostMouseEnter?
    postProps.ref = 'post';
    postProps.renderCollapsed = renderCollapsed;

    var baseElem = r[this.props.elemType];
    var depthClass = '';
    var indentationDepthClass = '';
    if (!isFlat) {
      depthClass = ' dw-depth-' + this.props.depth;
      indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    }
    var is2dColumnClass = this.props.is2dTreeColumn ? ' dw-2dcol' : '';
    var multireplyClass = post.multireplyPostIds.length ? ' dw-mr' : '';
    var collapsedClass = renderCollapsed ? ' dw-zd' : '';

    return (
      baseElem({ className: 'dw-t' + depthClass + indentationDepthClass + multireplyClass +
          is2dColumnClass + collapsedClass + avatarClass },
        arrows,
        anyAvatar,
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

  onClick: function(event) {
    var props = this.props;
    if (!props.abbreviate) {
      if (props.post.isTreeCollapsed || props.post.isPostCollapsed) {
        this.onUncollapseClick(event);
      }
      else {
        // Disable for now. This sets quickUpdate = true, which makes isClientSideCollapsed
        // impossible to undo, for nearby threads. And not used anyway.
        // debiki2.ReactActions.markPostAsRead(this.props.post.postId, true);
      }
    }
    if (props.onClick) {
      props.onClick();
    }
  },

  onAnyActionClick: function() {
    // Disable for now. Not in use anyway and see comment in this.onClick above.
    // debiki2.ReactActions.markPostAsRead(this.props.post.postId, true);
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
    var wrongWarning;
    var headerElem;
    var bodyElem;
    var clickToExpand;
    var clickCover;
    var extraClasses = this.props.className || '';
    var isFlat = post.postType === PostType.Flat;

    if (post.isTreeDeleted || post.isPostDeleted) {
      var what = post.isTreeDeleted ? 'Thread' : 'Comment';
      headerElem = r.div({ className: 'dw-p-hd' }, what, ' deleted');
      extraClasses += ' dw-p-dl';
    }
    else if (this.props.renderCollapsed &&
        // COULD rename isTreeCollapsed since it's not always a boolean.
        post.isTreeCollapsed !== 'Truncated') {
      // COULD remove this way of collapsing comments, which doesn't show the first line?
      // Currently inactive, this is dead code (!== 'Truncated' is always false).
      var text = this.props.is2dTreeColumn ? '' : (
          "Click to show " + (post.isTreeCollapsed ? "more comments" : "this comment"));
      if (debiki.debug) text +='  #' + this.props.postId;
      var iconClass = this.props.is2dTreeColumn ? 'icon-right-open' : 'icon-down-open';
      bodyElem =
          r.span({}, text, r.span({ className: 'dw-a-clps ' + iconClass }));
      extraClasses += ' dw-zd clearfix';
    }
    else if (!post.isApproved && !post.sanitizedHtml) {
      headerElem = r.div({ className: 'dw-p-hd' }, 'Hidden comment pending approval, posted ',
            timeAgo(post.createdAt), '.');
      extraClasses += ' dw-p-unapproved';
    }
    else {
      if (!post.isApproved) {
        var the = post.authorIdInt === user.userId ? 'Your' : 'The';
        pendingApprovalElem = r.div({ className: 'dw-p-pending-mod',
            onClick: this.onUncollapseClick }, the, ' comment below is pending approval.');
      }
      var headerProps = _.clone(this.props);
      headerProps.onMarkClick = this.onMarkClick;
      headerElem = PostHeader(headerProps);
      bodyElem = PostBody(this.props);

      if (post.isTreeCollapsed === 'Truncated' && !this.props.abbreviate) {
        extraClasses += ' dw-x';
        clickToExpand = r.div({ className: 'dw-x-show' }, "click to show");
        clickCover = r.div({ className: 'dw-x-cover' });
      }

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
    }

    // For non-multireplies, we never show "In response to" for the very first reply (index 0),
    // instead we draw an arrow. For flat replies, show "In response to" inside the header instead,
    // that looks better (see PostHeader).
    var replyReceivers;
    if (!this.props.abbreviate && !isFlat && (
          this.props.index > 0 || post.multireplyPostIds.length)) {
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

    if (isWikiPost(post))
      extraClasses += ' dw-wiki';

    if (isFlat)
      extraClasses += ' dw-p-flat';

    var unwantedCross;
    if (post.numUnwantedVotes) {
      extraClasses += ' dw-unwanted dw-unwanted-' + post.numUnwantedVotes;
      // Sync the max limit with CSS in client/app/.debiki-play.styl. [4KEF28]
      if (post.numUnwantedVotes >= 7) {
        extraClasses += ' dw-unwanted-max';
      }
      unwantedCross = r.div({ className: 'dw-unwanted-cross' });
    }

    var id = this.props.abbreviate ? undefined : 'post-' + post.postId;

    return (
      r.div({ className: 'dw-p ' + extraClasses, id: id,
            onMouseEnter: this.props.onMouseEnter, onClick: this.onClick },
        pendingApprovalElem,
        wrongWarning,
        replyReceivers,
        headerElem,
        bodyElem,
        clickToExpand,
        clickCover,
        unwantedCross));
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
    var receivers = [];
    for (var index = 0; index < repliedToPostIds.length; ++index) {
      var repliedToId = repliedToPostIds[index];
      if (repliedToId === NoPostId) {
        // This was a reply to the whole page, happens if one clicks the "Add comment"
        // button in the chat section, and then replies to someone too.
        continue;
      }
      var post = this.props.allPosts[repliedToId];
      if (!post) {
        receivers.push(r.i({ key: repliedToId }, 'Unknown [DwE4KFYW2]'));
        continue;
      }
      var link =
        r.a({ href: '#post-' + post.postId, className: 'dw-rr', key: post.postId },
          post.authorUsername || post.authorFullName);
      if (receivers.length) {
        link = r.span({ key: post.postId }, ' and', link);
      }
      receivers.push(link);
    }
    var elem = this.props.comma ? 'span' : 'div';
    return (
      r[elem]({ className: 'dw-rrs' + multireplyClass }, // rrs = reply receivers
        (this.props.comma ? ', i' : 'I') + 'n reply to', receivers, ':'));
  }
});



var PostHeader = createComponent({
  onUserClick: function(event) {
    debiki2.pagedialogs.getAboutUserDialog().open(this.props.post);
    event.preventDefault();
    event.stopPropagation();
  },

  onCollapseClick: function(event) {
    debiki2.ReactActions.collapseTree(this.props.post);
    event.stopPropagation();
  },

  showEditHistory: function() {
    debiki2.edithistory.getEditHistoryDialog().open(this.props.post.uniqueId);
  },

  render: function() {
    var post: Post = this.props.post;
    if (!post)
      return r.p({}, '(Post missing [DwE7IKW2])');

    if (isWikiPost(post)) {
      if (this.props.abbreviate) {
        return r.div({ className: 'dw-p-hd' }, 'Wiki');
      }
      if (this.props.is2dTreeColumn || post.isTreeCollapsed || post.postId === BodyPostId) {
        return null;
      }
      // Show a collapse button for this wiki post, but no author name because this is
      // a wiki post contributed to by everyone.
      return r.span({ className: 'dw-a-clps icon-up-open', onClick: this.onCollapseClick });
    }

    var user: User = this.props.user;
    var linkFn = this.props.abbreviate ? 'span' : 'a';

    var showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
    var anyAvatar = !showAvatar ? null : debiki2.avatar.Avatar({
      tiny: true,
      // For now: — later, replace authorUsername etc with a { id, username, fullName } object?
      user: {
        id: post.authorId,
        username: post.authorUsername,
        fullName: post.authorFullName,
        avatarUrl: post.authorAvatarUrl,
      }
    });

    // Username link: Some dupl code, see edit-history-dialog.ts. [88MYU2]
    var authorUrl = '/-/users/#/id/' + post.authorId;
    var namePart1;
    var namePart2;
    if (post.authorFullName && post.authorUsername) {
      namePart1 = r.span({ className: 'dw-username' }, post.authorUsername);
      namePart2 = r.span({ className: 'dw-fullname' }, ' (' + post.authorFullName + ')');
    }
    else if (post.authorFullName) {
      namePart1 = r.span({ className: 'dw-fullname' }, post.authorFullName);
      namePart2 = r.span({ className: 'dw-lg-t-spl' }, post.authorEmailUnknown ? '??' : '?');
    }
    else if (post.authorUsername) {
      namePart1 = r.span({ className: 'dw-username' }, post.authorUsername);
    }
    else {
      namePart1 = r.span({}, '(Unknown author)');
    }

    var editInfo = null;
    if (post.lastApprovedEditAt) {
      var editedAt = timeAgo(post.lastApprovedEditAt);
      var byVariousPeople = post.numEditors > 1 ? ' by various people' : null;
      editInfo =
          r.span({},
            ', ',
            r.span({ onClick: this.showEditHistory, className: 'dw-p-show-hist' },
              'edited ', editedAt),
            byVariousPeople);
    }

    var anyPin;
    if (post.pinnedPosition) {
      anyPin =
        r[linkFn]({ className: 'dw-p-pin icon-pin' });
    }

    var postId;
    var anyMark;
    if (post.postId !== TitleId && post.postId !== BodyPostId) {
      if (debiki.debug) {
        postId = r.span({ className: 'dw-p-link' }, '#' + post.postId);
      }

      /* COULD: Later on, move the star to the right? Or to the action list? And 
         to indicate that the computer has been read, paint a 3px border to the
         left of the header. And to indicate that the human has marked it as read,
         set the header's bg color to white.
      var mark = user.marksByPostId[post.postId];
      var starClass = ' icon-star';
      if (mark === ManualReadMark) {
        starClass = ' icon-star-empty';
      }
      // The outer -click makes the click area larger, because the marks are small.
      anyMark =
          r.span({ className: 'dw-p-mark-click', onClick: this.props.onMarkClick },
            r.span({ className: 'dw-p-mark icon-star' + starClass }));
      */
    }

    var isPageBody = post.postId === BodyPostId;
    var by = isPageBody ? 'By ' : '';
    var isBodyPostClass = isPageBody ? ' dw-ar-p-hd' : '';
    var suspendedClass = post.authorSuspendedTill ? ' dw-suspended' : '';

    var userLinkProps: any = {
      className: 'dw-p-by' + suspendedClass,
      onClick: this.props.abbreviate ? null : this.onUserClick,
      href: authorUrl
    };

    if (post.authorSuspendedTill === 'Forever') {
      userLinkProps.title = 'User banned';
    }
    else if (post.authorSuspendedTill) {
      userLinkProps.title = 'User suspended until ' + dateTimeFix(post.authorSuspendedTill);
    }

    var is2dColumn = this.props.horizontalLayout && this.props.depth === 1;
    var collapseIcon = is2dColumn ? 'icon-left-open' : 'icon-up-open';
    var isFlat = post.postType === PostType.Flat;
    var toggleCollapsedButton =
        is2dColumn || this.props.abbreviate || post.isTreeCollapsed || isPageBody || isFlat
          ? null
          : r.span({ className: 'dw-a-clps ' + collapseIcon, onClick: this.onCollapseClick });

    // For flat replies, show "In response to" here inside the header instead,
    // rather than above the header — that looks better.
    var inReplyTo;
    if (!this.props.abbreviate && isFlat && (post.parentId || post.multireplyPostIds.length)) {
      inReplyTo = ReplyReceivers({ post: post, allPosts: this.props.allPosts, comma: true });
    }

    return (
        r.div({ className: 'dw-p-hd' + isBodyPostClass },
          anyPin,
          postId,
          anyMark,
          anyAvatar,
          by,
          r[linkFn](userLinkProps, namePart1, namePart2),
          timeAgo(post.createdAt),
          editInfo,
          inReplyTo,
          toggleCollapsedButton));
  }
});


var PostBody = createComponent({
  render: function() {
    var post: Post = this.props.post;
    if (post.summarize) {
      return (
        r.div({ className: 'dw-p-bd' },
          r.div({ className: 'dw-p-bd-blk' },
            r.p({}, post.summary))));
    }
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
      r.div({ className: 'dw-p-bd' },
        // Beause of evil magic, without `null`, then `body` is ignored and the post becomes
        // empty, iff it was summarized and you clicked it to show it.
        // COULD test to remove `null` after having upgraded to React 0.13.
        null,
        body));
  }
});


var NoCommentsPageActions = createComponent({
  onEditClick: function(event) {
    debiki2.ReactActions.editPostWithNr(this.props.post.postId);
  },
  render: function() {
    var user: User = this.props.user;
    var post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    var actions;
    if (user.isAdmin) {
      actions =
          r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit');
    }

    return (
      r.div({ className: 'dw-p-as dw-as' }, actions));
  }
});


var PostActions = createComponent({
  onAcceptAnswerClick: function() {
    debiki2.ReactActions.acceptAnswer(this.props.post.uniqueId);
  },
  onUnacceptAnswerClick: function() {
    debiki2.ReactActions.unacceptAnswer();
  },
  onReplyClick: function(event) {
    var newPostType = this.props.post.postType === PostType.Flat ? PostType.Flat : PostType.Normal;
    debiki.internal.$showReplyForm.call(event.target, event, newPostType);
  },
  onCloseClick: function() {
    debiki2.ReactActions.togglePageClosed();
  },
  onEditClick: function(event) {
    debiki2.ReactActions.editPostWithNr(this.props.post.postId);
  },
  onLinkClick: function() {
    var hash = '#post-' + this.props.post.postId;
    var url = window.location.host + '/-' + debiki.getPageId() + hash;
    window.prompt('To copy a link to this post, press Ctrl+C then Enter', url);
  },
  onLikeClick: function(event) {
    debiki.internal.$toggleVote('VoteLike').call(event.target, event);
  },
  onWrongClick: function(event) {
    debiki.internal.$toggleVote('VoteWrong').call(event.target, event);
  },
  onBuryClick: function(event) {
    debiki.internal.$toggleVote('VoteBury').call(event.target, event);
  },
  onUnwantedClick: function(event) {
    debiki.internal.$toggleVote('VoteUnwanted').call(event.target, event);
  },
  onEditSuggestionsClick: function(event) {
    debiki.internal.$showEditsDialog.call(event.target, event);
  },
  onFlagClick: function(event) {
    debiki2.getFlagDialog().open(this.props.post.postId);
  },
  onDeleteClick: function(event) {
    debiki2.pagedialogs.getDeletePostDialog().open(this.props.post);
  },
  onWikifyClick: function(event) {
    debiki2.pagedialogs.getWikifyDialog().open(this.props.post);
  },
  /*
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
  }, */

  makeReplyBtnTitle: function(post: Post) {
    if (post.postId !== BodyId)
      return "Reply";

    switch (this.props.store.pageRole) {
      case PageRole.Critique: return "Give Critique"; // [plugin]
      default: return "Reply";
    }
  },

  render: function() {
    var post = this.props.post;
    var store: Store = this.props.store;
    var isQuestion = store.pageRole === PageRole.Question;
    // (Some dupl code, see Title above and isDone() and isAnswered() in forum.ts [4KEPW2]
    var isAnswered = isQuestion && store.pageAnsweredAtMs;
    var isDone = store.pageDoneAtMs && (store.pageRole === PageRole.Problem ||
      store.pageRole === PageRole.Idea || store.pageRole === PageRole.ToDo);

    if (!post.isApproved) // what?:  && !post.text)
      return null;

    var user: User = store.user;
    var isOwnPost = post.authorIdInt === user.userId;
    var isPageBody = post.postId === BodyPostId;
    var votes = user.votes[post.postId] || [];
    var isStaffOrOwnPost: boolean = isStaff(user) || isOwnPost;

    var deletedOrCollapsed =
      post.isPostDeleted || post.isTreeDeleted || post.isPostCollapsed || post.isTreeCollapsed;

    // For now. Later, add e.g. Undelete or View Deleted actions.
    // (Do return a <div> so there'll be some whitespace below for arrows to any replies.)
    if (deletedOrCollapsed)
      return r.div({ className: 'dw-p-as dw-as' });

    var acceptAnswerButton;
    if (isStaffOrOwnPost && isQuestion && !store.pageAnsweredAtMs && !store.pageClosedAtMs &&
        !isPageBody) {
      acceptAnswerButton = r.a({ className: 'dw-a dw-a-solve icon-ok-circled-empty',
          onClick: this.onAcceptAnswerClick, title: "Accept this as the answer to the " +
              "question or problem" }, "Solution?");
    }
    else if (isQuestion && post.uniqueId === store.pageAnswerPostUniqueId) {
      var solutionTooltip = isStaffOrOwnPost
          ? "Click to un-accept this answer"
          : "This post has been accepted as the answer";
      acceptAnswerButton = r.a({ className: 'dw-a dw-a-unsolve icon-ok-circled',
          onClick: isStaffOrOwnPost ? this.onUnacceptAnswerClick : null, title: solutionTooltip },
        "Solution");
    }

    var replyButton = null;
    if (!deletedOrCollapsed) {
      replyButton =
          r.a({ className: 'dw-a dw-a-reply icon-reply', onClick: this.onReplyClick },
            this.makeReplyBtnTitle(post));
    }

    // Show a close button for unanswered questions and pending to-dos, and a reopen
    // button if the topic has been closed unanswered / unfixed. (But if it's been
    // answered/fixed, the way to reopen it is to click the answered/fixed icon, to
    // mark it as not-answered/not-fixed again.)
    var closeReopenButton;
    var canCloseOrReopen = !isDone && !isAnswered && store.pageRole !== PageRole.About;
    if (isPageBody && canCloseOrReopen && isStaffOrOwnPost) {
      var closeReopenTitle = "Reopen";
      var closeReopenIcon = 'icon-circle-empty';
      var closeReopenTooltip;
      if (!store.pageClosedAtMs) {
        closeReopenTitle = "Close";
        closeReopenIcon = 'icon-cancel-circled';
        switch (store.pageRole) {
          case PageRole.Question:
            if (isOwnPost)
              closeReopenTooltip = "Close this question if you don't need an answer any more.";
            else
              closeReopenTooltip = "Close this question if it doesn't need an answer, e.g. if " +
                  "it is off-topic or already answered in another topic.";
            break;
          case PageRole.ToDo:
            closeReopenTooltip = "Close this To-Do if it does not need to be done or fixed.";
            break;
          default:
            closeReopenTooltip = "Close this topic if it needs no further consideration.";
        }
      }
      closeReopenButton = r.a({ className: 'dw-a dw-a-close ' + closeReopenIcon,
          onClick: this.onCloseClick, title: closeReopenTooltip }, closeReopenTitle);
    }

    var numLikesText;
    if (post.numLikeVotes) {
      numLikesText = r.a({ className: 'dw-a dw-vote-count' },
          post.numLikeVotes === 1 ? "1 Like" : post.numLikeVotes + " Likes");
    }

    var numWrongsText;
    if (post.numWrongVotes) {
      numWrongsText = r.a({ className: 'dw-a dw-vote-count' },
          post.numWrongVotes === 1 ? "1 Wrong" : post.numWrongVotes + " Wrongs");
    }

    // Bury votes aren't downvotes or bad in any way, so don't show them, except for
    // staff, so they can detect misuse.
    var numBurysText;
    if (isStaff(user) && post.numBuryVotes) {
      numBurysText = r.a({ className: 'dw-a dw-vote-count' },
          post.numBuryVotes === 1 ? "1 Bury" : post.numBuryVotes + " Burys");
    }

    var numUnwantedsText;
    if (post.numUnwantedVotes) {
      numUnwantedsText = r.a({ className: 'dw-a dw-vote-count' },
          post.numUnwantedVotes === 1 ? "1 Unwanted" : post.numUnwantedVotes + " Unwanteds");
    }

    var otherVotesDropdown = null;
    var likeVoteButton = null;
    if (!deletedOrCollapsed && !isOwnPost) {
      var myLikeVote = votes.indexOf('VoteLike') !== -1 ? ' dw-my-vote' : '';
      var myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : '';
      var myBuryVote = votes.indexOf('VoteBury') !== -1 ? ' dw-my-vote' : '';
      var myUnwantedVote = votes.indexOf('VoteUnwanted') !== -1 ? ' dw-my-vote' : '';
      var myOtherVotes = myWrongVote || myBuryVote || myUnwantedVote ? ' dw-my-vote' : '';

      var wrongVoteButton =
          r.a({ className: 'dw-a dw-a-wrong icon-warning' + myWrongVote,
            title: 'Click if you think this post is wrong, for example, factual errors, ' +
                " or because you disagree.", onClick: this.onWrongClick }, 'Wrong');
      var buryVoteButton =
        post.postType === PostType.Flat
            ? null // cannot change sort order or collapse flat comments
            : r.a({ className: 'dw-a dw-a-bury icon-bury' + myBuryVote,
              title: "Click if you think it's better that people spend their time " +
                  "reading other things instead.", onClick: this.onBuryClick }, 'Bury');
      var unwantedVoteButton =
          r.a({ className: 'dw-a dw-a-unwanted icon-cancel' + myUnwantedVote,
              title: "Click if you do not want this comment on this site.",
                  onClick: this.onUnwantedClick }, "Unwanted");

      otherVotesDropdown = post.postId === BodyPostId ? null :
          r.span({ className: 'dropdown navbar-right' },
            r.a({ className: 'dw-a dw-a-votes' + myOtherVotes, 'data-toggle': 'dropdown' }, ''),
            r.div({ className: 'dropdown-menu dropdown-menu-right dw-p-as-votes' },
                wrongVoteButton, buryVoteButton, unwantedVoteButton));

      likeVoteButton =
          r.a({ className: 'dw-a dw-a-like icon-heart' + myLikeVote,
            title: "Like this", onClick: this.onLikeClick });
    }

    var editOwnPostButton = deletedOrCollapsed || !isOwnPost
        ? null
        : r.a({ className: 'dw-a dw-a-edit icon-edit', title: "Edit",
              onClick: this.onEditClick });

    var link = deletedOrCollapsed
        ? null
        : r.a({ className: 'dw-a dw-a-link icon-link', title: "Link to this post",
              onClick: this.onLinkClick });

    var moreLinks = [];

    if (!isOwnPost) {
      var mayEdit = isStaff(user) || (
          user.isAuthenticated && post.postType === PostType.CommunityWiki);
      if (mayEdit) {
        moreLinks.push(
          r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick, key: 'ed' },
            'Edit'));
      }
    }

    moreLinks.push(
        r.a({ className: 'dw-a dw-a-flag icon-flag', onClick: this.onFlagClick, key: 'rp' },
          'Report'));

    /* Doesn't work right now, after Post2 rewrite
    if (user.isAdmin && !isPageBody)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-pin icon-pin', onClick: this.onPinClick, key: 'pn' }, 'Pin'));
    */

    // Enable some hard-to-use features for me only right now.
    var isKajMagnusSite = debiki.siteId === '3';

    /* Suggestions code removed, I'll rewrite and add back later.
    if (post.numPendingEditSuggestions > 0)
      suggestionsNew.push(
          r.a({ className: 'dw-a dw-a-edit-suggs icon-edit dw-a-pending-review',
           title: 'View edit suggestions', onClick: this.onEditSuggestionsClick },
            '×', post.numPendingEditSuggestions));
    */

    /*  Find some better way to do this. And also, don't show so many buttons below More.
    if (!post.isTreeCollapsed && !isPageBody && user.isAdmin && isKajMagnusSite)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-collapse-tree icon-collapse',
            onClick: this.onCollapseTreeClick, key: 'ct' }, 'Collapse tree'));

    if (!post.isPostCollapsed && !isPageBody && user.isAdmin && isKajMagnusSite)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-collapse-post icon-collapse',
            onClick: this.onCollapsePostClick, key: 'cp' }, 'Collapse post'));

    if (post.isTreeCollapsed && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-uncollapse-tree', key: 'ut' }, 'Uncollapse tree'));

    if (post.isPostCollapsed && user.isAdmin)
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-uncollapse-post', key: 'up' }, 'Uncollapse post'));
    */

    // ----- Close links

    /* Doesn't work any longer, not after Post2 rewrite.
    if (post.isTreeClosed && user.isAdmin) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-reopen-tree', key: 'ro' }, 'Reopen'));
    }
    else if (!isPageBody && user.isAdmin) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-close-tree icon-archive',
            onClick: this.onCloseTreeClick, key: 'cl' }, 'Close'));
    }
    */

    // ----- Move links

    // ? <a class="dw-a dw-a-move">Move</a>

    // ----- Delete links

   // remove classes:
   // r.a({ className: 'dw-a dw-a-delete-suggs icon-delete-tree dw-a-pending-review',
   // r.a({ className: 'dw-a dw-a-delete-suggs icon-delete-post dw-a-pending-review',
   // r.a({ className:'dw-a dw-a-collapse-suggs icon-collapse-post dw-a-pending-review',
   // r.a({ className: 'dw-a dw-a-collapse-suggs icon-collapse-tree dw-a-pending-review',

    if (!isPageBody && isStaff(user)) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-delete icon-trash', onClick: this.onDeleteClick, key: 'dl' },
          'Delete'));
    }

    if (isStaff(user) && post.postType !== PostType.Flat) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-users', onClick: this.onWikifyClick, key: 'wf' },
          isWikiPost(post) ? 'Un-Wikify' : 'Wikify'));
    }

    var moreDropdown =
      r.span({ className: 'dropdown navbar-right' },
        r.a({ className: 'dw-a dw-a-more icon-menu', 'data-toggle': 'dropdown' }),
        r.div({ className: 'dropdown-menu dropdown-menu-right dw-p-as-more' },
          moreLinks));

    return (
      r.div({ className: 'dw-p-as dw-as', onClick: this.props.onClick },
        //suggestionsNew,
        //suggestionsOld,
        replyButton,
        closeReopenButton,
        moreDropdown,
        link,
        editOwnPostButton,
        otherVotesDropdown,
        likeVoteButton,
        numBurysText,
        numWrongsText,
        numLikesText,
        numUnwantedsText,
        acceptAnswerButton));
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


function isWikiPost(postOrPostType: any) {
  var type;
  if (postOrPostType) {
    type = postOrPostType.postType || postOrPostType;
  }
  return type === PostType.StaffWiki || type === PostType.CommunityWiki;
}


function authorIsGuest(post) {
  // Guest ids currently start with '-'.
  return post.authorId && post.authorId.length >= 1 && post.authorId[0] === '-';
}


function makePageClosedTooltipText(pageRole: PageRole) {
  switch (pageRole) {
    case PageRole.Question:
      return "This question has been closed without any accepted answer.";
    case PageRole.ToDo:
      return "This To-Do has been closed. It probably won't be done or fixed.";
    default:
      return "This topic is closed.";
  }
}


function makeQuestionTooltipText(isAnswered) {
  return isAnswered ? "This is a solved question" : "This is an unsolved question";
}


function renderTitleBodyComments() {
  var root = document.getElementById('dwPosts');
  if (!root)
    return;

  debiki2.avatar.resetAvatars();

  var store: Store = debiki2.ReactStore.allData();
  if (store.pageRole === PageRole.Forum) {
    var router = ReactRouter.create({
      routes: debiki2.forum.buildForumRoutes(),
      scrollBehavior: debiki2.forum.ForumScrollBehavior,
    });
    router.run(function(handler) {
      React.render(React.createElement(handler, store), root);
    });
  }
  else {
    React.render(PageWithState(), root);
  }
}


function renderTitleBodyCommentsToString() {
  debiki2.avatar.resetAvatars();

  // Comment in the next line to skip React server side and debug in browser only.
  //return '<p class="dw-page" data-reactid=".123" data-react-checksum="123">react_skipped</p>'
  var store: Store = debiki2.ReactStore.allData();
  if (store.pageRole === PageRole.Forum) {
    var routes = debiki2.forum.buildForumRoutes();
    var result;
    // In the future, when using the HTML5 history API to update the URL when navigating
    // inside the forum, we can use `store.pagePath` below. But for now, when using
    // the hash fragment, start at #/latest/ (the default route) always:
    var pagePath = '/latest/';
    ReactRouter.run(routes, pagePath, function(handler) {
      result = React.renderToString(React.createElement(handler, store));
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
