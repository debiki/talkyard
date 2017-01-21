/*
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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
/// <reference path="../help/help.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../model.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="post-actions.ts" />
/// <reference path="chat.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var React = window['React']; // TypeScript file doesn't work
var r = React.DOM;
var $: JQueryStatic = debiki.internal.$;

var closedIcon = r.span({ className: 'icon-block' });
var questionIcon = r.span({ className: 'icon-help-circled' });
var problemIcon = r.span({ className: 'icon-attention-circled' });
var solvedIcon = r.span({ className: 'icon-ok-circled' });
var todoIcon = r.span({ className: 'icon-check-empty' });
var ideaIcon = r.span({ className: 'icon-idea' });
var plannedIcon = r.span({ className: 'icon-check-empty' });
var doneIcon = r.span({ className: 'icon-check' });


export var TitleBodyComments = createComponent({
  makeHelpMessage: function(): HelpMessage {
    var store: Store = this.props.store;
    var me: Myself = store.me;
    var bodyPost = store.postsByNr[BodyNr];

    if (store.pageRole === PageRole.Form && store.pageClosedAtMs)
      return { id: 'EsH4PK04', version: 1, content: r.div({},
        "This form has been ", closedIcon, "closed; you can no longer fill it in and post it.") };

    // If this page was closed prematurely, show "... has been closed ..." instead of
    // e.g. "... is waiting for an answer..."
    if (store.pageClosedAtMs && !store.pageDoneAtMs && !store.pageAnsweredAtMs)
      return { id: 'EdH7UMPW', version: 1, content: r.div({},
          "This topic has been ", closedIcon, "closed. You can still post comments, " +
          "but that won't make this topic bump to the top of the latest-topics list.") };

    /*
    if (store.pageLockedAtMs)
      ...

    if (store.pageFrozenAtMs)
      ...
    */

    if (store.pageRole === PageRole.Question) {
      if (store.pageAnsweredAtMs) {
        return { id: 'EsH5JV8', version: 1, content: r.div({ className: 'esHelp-solved' },
            "This is a question and it has been ", solvedIcon, "answered.") };
      }
      else {
        return { id: 'EsH2YK03', version: 1, content: r.div({},
            "This is a ", questionIcon, "question, waiting for an ", solvedIcon, "answer.") };
      }
    }

    if (store.pageRole === PageRole.Problem) {
      if (store.pageDoneAtMs) {
        return { id: 'EsH5GKU0', version: 1, className: 'esH_ProblemSolved', content: r.div({},
            "This is a problem and it has been ", doneIcon, " solved.") };
      }
      else if (store.pagePlannedAtMs) {
        return { id: 'EsH2PK40', version: 1, className: 'esH_ProblemFixing', content: r.div({},
            "This is a problem. Someone is ", plannedIcon, " fixing it, but it's not yet ",
            doneIcon, " done.") };
      }
      else {
        return { id: 'EsH1WKG5', version: 1, className: 'esH_ProblemNew', content: r.div({},
            "This is a ", problemIcon, " problem. It's not yet ", doneIcon, " solved.") };
      }
    }

    if (store.pageRole === PageRole.Idea) {
      if (store.pageDoneAtMs) {
        return { id: 'EsH9PK0', version: 1, content: r.div({},
            "This is an idea that has been ", doneIcon, " implemented.") };
      }
      else if (store.pagePlannedAtMs) {
        return { id: 'EsH44TK2', version: 1, content: r.div({},
            "This idea has been ", plannedIcon, " planned, or is in progress. " +
            "But it's not yet ", doneIcon, " done.") };
      }
      else {
        return { id: 'EsH4GY6Z', version: 1, content: r.div({},
            "This is an ", ideaIcon, " idea, not yet ", plannedIcon, " planned, not yet ",
            doneIcon, " done.") };
      }
    }

    if (store.pageRole === PageRole.ToDo) {
      if (store.pageDoneAtMs) {
        return { id: 'EsH22PKU', version: 1, content: r.div({},
          "This is a todo; it's been ", doneIcon, " done.") };
      }
      else {
        return { id: 'EsH3WY42', version: 1, content: r.div({},
          "This is a ", plannedIcon, " todo task, not yet ", doneIcon, " done.") };
      }
    }

    if (store.pageRole === PageRole.Critique) {  // [plugin]. Dupl code, (39pKFU0) below
      if (store.pageClosedAtMs) {
        return { id: 'EdH4KDPU2', version: 1, content: r.span({},
          "This topic has been ", closedIcon, "closed. People won't get any additional " +
          "credits for posting more critique here.") };
      }
      if (!me.isAuthenticated) {
        // Could explain: here someone has asked for critique. X people have answered,
        // see the Replies section below.
        return null;
      }
      else {
        var isPageAuthor = bodyPost.authorId === me.id;
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
                  "Next, proofread your text below, to make sure it asks for " +
                  "the right things and is easy to understand. To edit it, " +
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

    if (store.pageRole === PageRole.UsabilityTesting) {  // [plugin]. Dupl code, (39pKFU0) above
      if (store.pageClosedAtMs) {
        return { id: 'EdH5KFEW3', version: 1, content: r.span({},
          "This topic has been ", closedIcon, "closed. Find another topic, if you are going " +
          "to do usability testing.") };
      }
      if (!me.isAuthenticated) {
        // Could explain: here someone has asked for usability testing. X people have answered,
        // see the Replies section below.
        return null;
      }
      else {
        var isPageAuthor = bodyPost.authorId === me.id;
        if (isPageAuthor) {
          if (store.numPostsRepliesSection) {
            return { id: 'EdH5P0WF2', version: 1, content: r.span({},
              "There's a reply to you below — is it a usability testing video link?") };
          }
          else {
            return { id: 'EdH5PK2W', version: 1, alwaysShow: true, className: 's_UtxHelp_HaveAsked',
              content: r.div({},
                r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                  "Now you have asked for usability testing."),
                r.p({}, "You'll be notified via email, " +
                  "when someone has recorded a video for you."),
                r.p({},
                  "Proofread your text below, to make sure it asks for " +
                  "the right things and is easy to understand. To edit it, " +
                  "click the edit icon (", r.span({ className: 'icon-edit' }), ") ",
                  // People only see the edit icon for the title — try to fix this, by making
                  // 'below' bold so they'll look below instead.
                  r.b({}, "below"), " your post. — Thereafter, click Continue."),
                r.a({ className: 's_UtxHelp_HaveAsked_ContinueB btn btn-primary',
                    href: '/record-a-video' }, "Continue")) };
          }
        }
      }
    }

    return null;
  },

  render: function() {
    var store: Store = this.props.store;

    var anyHelpMessage = this.makeHelpMessage();
    anyHelpMessage = anyHelpMessage
        ? debiki2.help.HelpMessageBox({ message: anyHelpMessage })
        : null;

    var anyAboutCategoryClass;
    var anyAboutCategoryTitle;
    if (store.pageRole === PageRole.About) {
      anyAboutCategoryClass = 'dw-about-category';
      anyAboutCategoryTitle =
          r.h2({ className: 'dw-about-cat-ttl-prfx' }, "About category:")
    }

    var anyTitle = null;
    var pageRole: PageRole = store.pageRole;
    if (pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.EmbeddedComments ||
        store.rootPostId !== BodyNr) {
      // Show no title for the homepage — it should have its own custom HTML with
      // a title and other things.
      // Embedded comment pages have no title, only comments.
      // And show no title if we're showing a comment not the article as the root post.
    }
    else {
      anyTitle = Title(store);
    }

    var anyPostHeader = null;
    var anySocialLinks = null;
    if (pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.Forum ||
        pageRole === PageRole.About || pageRole === PageRole.WebPage ||
        pageRole === PageRole.SpecialContent || pageRole === PageRole.Blog ||
        pageRole === PageRole.EmbeddedComments ||
        store.rootPostId !== BodyNr) {
      // Show no author name or social links for these generic pages.
      // And show nothing if we're showing a comment not the article as the root post.
    }
    else {
      var post = store.postsByNr[store.rootPostId];
      var headerProps: any = _.clone(store);
      headerProps.post = post;
      anyPostHeader = PostHeader(headerProps);
      anySocialLinks = SocialLinks({ socialLinksHtml: store.socialLinksHtml });
    }

    var embeddedClass = store.isInEmbeddedCommentsIframe ? ' dw-embedded' : '';

    return (
      r.div({ className: anyAboutCategoryClass },
        anyHelpMessage,
        anyAboutCategoryTitle,
        r.div({ className: 'debiki dw-page' + embeddedClass },
          anyTitle,
          anyPostHeader,
          anySocialLinks,
          RootPostAndComments(store))));
  },
});


export var Title = createComponent({
  getInitialState: function() {
    return { isEditing: false };
  },

  scrollToAnswer: function() {
    debiki2.ReactActions.loadAndShowPost(this.props.pageAnswerPostNr);
    debiki2['page'].addVisitedPosts(TitleNr, this.props.pageAnswerPostNr);
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
    var titlePost = store.postsByNr[TitleNr];
    if (!titlePost)
      return null;

    var me: Myself = store.me;
    var isMyPage = store_thisIsMyPage(store);
    var isStaffOrMyPage: boolean = isStaff(me) || isMyPage;

    var titlePendingApprovalMessage = titlePost.isApproved ? false :
        r.span({ className: 'esPendingApproval' },
          store.pageDeletedAtMs ? "(Page deleted)" : "(Page pending approval)");

    var titleText = titlePost.sanitizedHtml;

    // Make forum titles link back to the forum default view.
    if (store.pageRole === PageRole.Forum) {
      titleText = r.a({ href: store.pagePath.value }, titleText);
    }

    var anyShowForumInroBtn;
    if (!this.props.hideButtons && store.pageRole === PageRole.Forum && store.hideForumIntro) {
      var introPost = store.postsByNr[BodyNr];
      if (introPost && !introPost.isBodyHidden) {
        // Don't show button too early — doing that would make server side and client side
        // React generated html differ.
        if (store.userSpecificDataAdded) {
          anyShowForumInroBtn =
              r.a({ className: 'icon-info-circled dw-forum-intro-show',
                  onClick: () => debiki2['ReactActions'].showForumIntro(true) });
        }
      }
    }

    var anyEditTitleBtn;
    if (!this.props.hideButtons && isStaffOrMyPage) {
      anyEditTitleBtn =
        r.a({ className: 'dw-a dw-a-edit icon-edit', id: 'e2eEditTitle', onClick: this.editTitle });
    }

    var contents;
    if (this.state.isEditing) {
      var editorProps = _.clone(this.props);
      editorProps.closeEditor = this.closeEditor;
      contents = morebundle.TitleEditor(editorProps);
    }
    else {
      var pinOrHiddenClass = this.props.pinWhere ? ' icon-pin' : '';
      if (store.pageHiddenAtMs) {
        pinOrHiddenClass = ' icon-eye-off';
      }
      var tooltip = '';
      var icon;
      // (Some dupl code, see PostActions below and isDone() and isAnswered() in forum.ts [4KEPW2]
      if (store.pageClosedAtMs && !store.pageDoneAtMs && !store.pageAnsweredAtMs) {
        icon = r.span({ className: 'icon-block' });
        tooltip = makePageClosedTooltipText(store.pageRole) + '\n';
      }
      else if (store.pageRole === PageRole.Question) {
        var icon = store.pageAnsweredAtMs
            ? r.a({ className: 'icon-ok-circled dw-clickable', onClick: this.scrollToAnswer })
            : r.span({ className: 'icon-help-circled' });
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
                ? "This is an unsolved problem"
                : "This is an idea";
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
        if (!isStaffOrMyPage) iconTooltip = null;
        var clickableClass = isStaffOrMyPage ? ' dw-clickable' : '';
        var onClick = isStaffOrMyPage ? this.cycleIsDone : null;
        icon = r.span({ className: iconClass + clickableClass, onClick: onClick,
            title: iconTooltip });
      }
      else if (store.pageRole === PageRole.FormalMessage) {
        icon = r.span({ className: 'icon-mail' });
        tooltip = "Personal message";
      }
      else if (store.pageRole === PageRole.OpenChat) {
        icon = '#';
        tooltip = "# means Chat Channel";
      }
      else if (store.pageRole === PageRole.PrivateChat) {
        icon = r.span({ className: 'icon-lock' });
        tooltip = "This is a private chat channel";
      }

      switch (this.props.pinWhere) {
        case PinPageWhere.Globally: tooltip += "\nPinned globally."; break;
        case PinPageWhere.InCategory: tooltip += "\nPinned in this category."; break;
        default:
      }

      let deletedIcon;
      if (store_isPageDeleted(store)) {
        let deletedReason = store.pageDeletedAtMs ?
            "This page has been deleted" : "Category deleted, so this page was deleted too";
        deletedIcon = r.span({ className: 'icon-trash', title: deletedReason });
        titleText = r.span({ className: 'esOP_title-deleted' }, titleText);
      }

      contents =
          r.div({ className: 'dw-p-bd' },
            r.div({ className: 'dw-p-bd-blk' },
              r.h1({ className: 'dw-p-ttl' + pinOrHiddenClass, title: tooltip },
                deletedIcon, titlePendingApprovalMessage,
                icon, titleText,
                anyShowForumInroBtn, anyEditTitleBtn)));
    }
    return (
      r.div({ className: 'dw-t', id: 'dw-t-0' },
        r.div({ className: 'dw-p dw-p-ttl', id: 'post-0' },
          contents)));
  },
});


// (DELETE_LATER year 2017? not in use anywhere any longer, + delete all related stuff.)
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

  loadAndShowRootPost: function(event) {
    event.preventDefault();
    let store: Store = this.props;
    ReactActions.loadAndShowPost(store.rootPostId);
  },

  onOrigPostReplyClick: function() {
    // Dupl code [69KFUW20]
    debiki2.morebundle.loginIfNeededReturnToPost('LoginToComment', BodyNr, function() {
      editor.toggleWriteReplyToPost(BodyNr, PostType.Normal);
    });
  },

  /*
  onChatReplyClick: function() {
    // Unless shown alraedy, or read already, show a tips about clicking "Reply" instead.
    var hasReadClickReplyTips = debiki2.help.isHelpMessageClosed(this.props, clickReplyInsteadHelpMessage);
    if (hasReadClickReplyTips || this.state.showClickReplyInstead) {
      debiki.internal.showReplyFormForFlatChat();
    }
    else {
      this.setState({ showClickReplyInstead: true });
    }
  }, */

  render: function() {
    var store: Store = this.props;
    var postsByNr: { [postNr: number]: Post; } = this.props.postsByNr;
    var me = store.me;
    var rootPost: Post = postsByNr[this.props.rootPostId];
    if (!rootPost)
      return r.p({}, '(Root post missing, id: ' + this.props.rootPostId +
          ', these are present: ' + _.keys(postsByNr) + ' [DwE8WVP4])');
    var isBody = this.props.rootPostId === BodyNr;
    var pageRole: PageRole = this.props.pageRole;
    var threadClass = 'dw-t dw-depth-0' + horizontalCss(this.props.horizontalLayout);
    var postIdAttr = 'post-' + rootPost.nr;
    var postClass = 'dw-p';
    if (post_shallRenderAsHidden(rootPost)) postClass += ' s_P-Hdn';
    var postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t';
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    var bodyPendingApprovalMessage = rootPost.isApproved ? false :
        r.div({ className: 'esPendingApproval' },
          store.pageDeletedAtMs ? "(Page deleted)" : "(Page pending approval)");

    var body = null;
    if (pageRole !== PageRole.EmbeddedComments) {
      let bodyContent;
      if (post_shallRenderAsHidden(rootPost)) {
        bodyContent = (
            r.div({ className: 'dw-p-bd-blk esOrigPost', onClick: this.loadAndShowRootPost },
              "Post hidden; click to show"));
      }
      else {
        bodyContent = (
            r.div({ className: 'dw-p-bd-blk esOrigPost',
              dangerouslySetInnerHTML: { __html: rootPost.sanitizedHtml }}));
      }
      body =
        r.div({ className: postClass, id: postIdAttr },
          r.div({ className: postBodyClass },
            bodyContent));
    }

    if (!page_isDiscussion(pageRole)) {
      if (store_thereAreFormReplies(store) && me.isAdmin) {
        // Show the completed forms for the admin (i.e. don't return here).
        // COULD show for page creator too — but currently s/he is always an admin. [6JK8WHI3]
      }
      else return (
        r.div({ className: threadClass },
          body,
          NoCommentsPageActions({ post: rootPost, me: me })));
    }

    var solvedBy;
    if (store.pageRole === PageRole.Question && store.pageAnsweredAtMs) {
      // onClick:... handled in ../utils/show-and-highlight.js currently (scrolls to solution).
      solvedBy = r.a({ className: 'dw-solved-by icon-ok-circled',
          href: '#post-' + store.pageAnswerPostNr },
        "Solved in post #" + store.pageAnswerPostNr + ", click to view");
    }

    var anyHorizontalArrowToChildren = null;
    if (this.props.horizontalLayout) {
      anyHorizontalArrowToChildren =
          debiki2.renderer.drawHorizontalArrowFromRootPost(rootPost);
    }

    var repliesAreFlat = false;
    var childIds = rootPost.childIdsSorted.concat(this.props.topLevelCommentIdsSorted);

    // On message pages, most likely max a few people talk — then threads make no sense.
    // On form submission pages, people don't see each others submissions, won't talk at all.
    if (store.pageRole === PageRole.FormalMessage || store.pageRole === PageRole.Form) {
      repliesAreFlat = true;
      childIds = _.values(store.postsByNr).map((post: Post) => post.nr);
    }

    var isSquashing = false;

    var threadedChildren = childIds.map((childId, childIndex) => {
      if (childId === BodyNr || childId === TitleNr)
        return null;
      var child = postsByNr[childId];
      if (!child)
        return null; // deleted
      if (isSquashing && child.squash)
        return null;
      if (child.postType === PostType.Flat)  // could rename Flat to Comment?
        return null;
      isSquashing = false;
      var threadProps = _.clone(this.props);
      if (repliesAreFlat) threadProps.isFlat = true;
      threadProps.elemType = 'div';
      threadProps.postId = childId;  // rename to .postNr, right?
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

    // Disable chat comments for now, they make people confused, and  [8KB42]
    // it'd be hard & take long to make them simpler to understand.
    var hasChat = false; // hasChatSection(store.pageRole);

    var flatComments = []; /*
    if (hasChat) _.each(store.postsByNr, (child: Post, childId) => {
      if (!child || child.postType !== PostType.Flat)
        return null;
      var threadProps = _.clone(this.props);
      threadProps.isFlat = true;
      threadProps.elemType = 'div';
      threadProps.postId = childId;
      // The index is used for drawing arrows but here there'll be no arrows.
      threadProps.index = null;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      flatComments.push(
        r.li({ key: childId },
          Thread(threadProps)));
    }); */

    var chatSection; /* Perhaps add back later — but probably not? [8KB42]
    if (hasChat) {
      var anyClickReplyInsteadHelpMessage = this.state.showClickReplyInstead
          ? debiki2.help.HelpMessageBox({ large: true, message: clickReplyInsteadHelpMessage })
          : null;
      chatSection =
        r.div({},
          r.div({ className: 'dw-chat-title', id: 'dw-chat' },
            store.numPostsChatSection + " chat comments"),
          r.div({ className: 'dw-vt' },
            r.div({ className: 'dw-chat dw-single-and-multireplies' },
                r.ol({ className: 'dw-res dw-singlereplies' },
                  flatComments))),
          anyClickReplyInsteadHelpMessage,
          r.div({ className: 'dw-chat-as' },
            r.a({ className: 'dw-a dw-a-reply icon-comment-empty', onClick: this.onChatReplyClick,
                title: "In a chat comment you can talk lightly and casually about this topic," +
                  " or post a status update. — However, to reply to someone, " +
                  "instead click Reply just below his or her post." },
              " Add chat comment")));
    } */

    var flatRepliesClass = repliesAreFlat ? ' dw-chat' : ''; // rename dw-chat... to dw-flat?

    let postActions = post_shallRenderAsHidden(rootPost) ? null :
         PostActions({ store: this.props, post: rootPost });

    let origPostReplyButton = _.every(threadedChildren, c => _.isEmpty(c)) ? null :
      r.div({ className: 's_APAs'},
        r.a({ className: 's_APAs_OPRB dw-a dw-a-reply icon-reply',
            onClick: this.onOrigPostReplyClick },
          makeReplyBtnTitle(store, rootPost, true)));

    return (
      r.div({ className: threadClass },
        bodyPendingApprovalMessage,
        body,
        solvedBy,
        postActions,
        debiki2.page.Metabar(),
        anyHorizontalArrowToChildren,
        // try to remove the dw-single-and-multireplies div + the dw-singlereplies class,
        // they're no longer needed.
        r.div({ className: 'dw-single-and-multireplies' + flatRepliesClass },
          r.ol({ className: 'dw-res dw-singlereplies' },
            threadedChildren)),
        origPostReplyButton,
        chatSection));
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
    var postsByNr: { [postNr: number]: Post; } = this.props.postsByNr;
    var post: Post = postsByNr[this.props.postId];
    var parentPost: Post = postsByNr[post.parentNr];

    var arrows = debiki2.renderer.drawArrowsFromParent(
      postsByNr, parentPost, this.props.depth, this.props.index,
      this.props.horizontalLayout, this.props.rootPostId, !!post.branchSideways);

    var baseElem = r[this.props.elemType];
    var depthClass = ' dw-depth-' + this.props.depth;
    var indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    var is2dColumnClass = this.props.is2dTreeColumn ? ' dw-2dcol' : '';
    var postNrDebug = debiki.debug ? '  #' + post.nr : '';

    return (
      baseElem({ className: 'dw-t dw-ts-squashed' + depthClass + indentationDepthClass +
          is2dColumnClass },
        arrows,
        r.a({ className: 'dw-x-show', onClick: this.onClick },
          "Click to show more replies" + postNrDebug)));
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
    var store: Store = this.props;
    var postsByNr: { [postNr: number]: Post; } = store.postsByNr;
    var post: Post = postsByNr[this.props.postId];
    if (!post) {
      // This tree has been deleted.
      return null;
    }

    var parentPost = postsByNr[post.parentNr];
    var deeper = this.props.depth + 1;
    var isFlat = this.props.isFlat;
    var isMindMap = store.pageRole === PageRole.MindMap;
    var childrenSideways = isMindMap && !!post.branchSideways;
    var thisPostSideways = isMindMap && !!parentPost.branchSideways;

    // Draw arrows, but not to multireplies, because we don't know if they reply to `post`
    // or to other posts deeper in the thread.
    var arrows;
    if (!post.multireplyPostNrs.length && !isFlat) {
      arrows = debiki2.renderer.drawArrowsFromParent(
        postsByNr, parentPost, this.props.depth, this.props.index,
        this.props.horizontalLayout, this.props.rootPostId, thisPostSideways);
    }

    var anyHorizontalArrowToChildren;
    if (childrenSideways) {
      anyHorizontalArrowToChildren =
        debiki2.renderer.drawHorizontalArrowFromRootPost(post);
    }

    var numDeletedChildren = 0;
    for (var i = 0; i < post.childIdsSorted.length; ++i) {
      var childId = post.childIdsSorted[i];
      if (!postsByNr[childId]) {
        numDeletedChildren += 1;
      }
    }

    var isSquashingChildren = false;

    var children = [];
    if (!post.isTreeCollapsed && !post.isTreeDeleted && !isFlat) {
      children = post.childIdsSorted.map((childId, childIndex) => {
        var child = postsByNr[childId];
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
        if (childrenSideways) {
          childIndentationDepth = 0;
        }
        var threadProps = _.clone(this.props);
        threadProps.elemType = childrenSideways ? 'div' : 'li';
        threadProps.postId = childId;
        threadProps.index = childIndex;
        threadProps.depth = deeper;
        threadProps.indentationDepth = childIndentationDepth;
        threadProps.is2dTreeColumn = childrenSideways;
        threadProps.key = childId;
        var thread;
        if (child.squash) {
          isSquashingChildren = true;
          thread = SquashedThreads(threadProps);
        }
        else {
          thread = Thread(threadProps);
        }
        if (threadProps.is2dTreeColumn) {
          // Need a <div> inside the <li> so margin-left can be added (margin-left otherwise
          // won't work, because: display table-cell [4GKUF02]).
          thread = r.li({ key: childId }, thread);
        }
        return thread;
      });
    }

    var actions = isCollapsed(post) || post_shallRenderAsHidden(post)
      ? null
      : PostActions({ store: this.props, post: post,
          onClick: this.onAnyActionClick });

    var renderCollapsed = (post.isTreeCollapsed || post.isPostCollapsed) &&
        // Don't collapse threads in the sidebar; there, comments are abbreviated
        // and rendered in a flat list.
        !this.props.abbreviate;

    var anyWrongWarning = this.props.abbreviate ? null : makeWrongWarning(post);

    var showAvatar = !renderCollapsed && this.props.depth === 1 && !this.props.is2dTreeColumn;
    var avatarClass = showAvatar ? ' ed-w-avtr' : '';
    var anyAvatar = !showAvatar ? null :
        avatar.Avatar({ user: store_getAuthorOrMissing(store, post) });

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
    var multireplyClass = post.multireplyPostNrs.length ? ' dw-mr' : '';
    var collapsedClass = renderCollapsed ? ' dw-zd' : '';

    var branchSidewaysClass = horizontalCss(!!post.branchSideways);

    return (
      baseElem({ className: 'dw-t' + depthClass + indentationDepthClass + multireplyClass +
          is2dColumnClass + branchSidewaysClass + collapsedClass + avatarClass },
        arrows,
        anyWrongWarning,
        anyAvatar,
        Post(postProps),
        actions,
        anyHorizontalArrowToChildren,
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            children))));
  },
});


function makeWrongWarning(post: Post) {
  if (post.numWrongVotes <= 1)
    return null;

  var wrongWarning = null;
  var wrongness = post.numWrongVotes / (post.numLikeVotes || 1);
  // One, two, three, many.
  if (post.numWrongVotes > 3 && wrongness > 1) {
    wrongWarning =
      r.div({ className: 'esWrong esWrong-Very' },
        r.div({ className: 'esWrong_Txt icon-warning' }, "Many disagree with this:"));
  }
  else if (wrongness > 0.33) {
    wrongWarning =
      r.div({ className: 'esWrong' },
        r.div({ className: 'esWrong_Txt icon-warning' }, "Some disagree with this:"));
  }
  return wrongWarning;
}


export var Post = createComponent({
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
        // debiki2.ReactActions.markPostAsRead(this.props.post.nr, true);
      }
    }
    if (props.onClick) {
      props.onClick();
    }
  },

  onAnyActionClick: function() {
    // Disable for now. Not in use anyway and see comment in this.onClick above.
    // debiki2.ReactActions.markPostAsRead(this.props.post.nr, true);
  },

  onMarkClick: function(event) {
    // Try to avoid selecting text:
    event.stopPropagation();
    event.preventDefault();
    debiki2.ReactActions.cycleToNextMark(this.props.post.nr);
  },

  render: function() {
    var store: Store = this.props;
    var post: Post = this.props.post;
    var me: Myself = this.props.me;
    if (!post)
      return r.p({}, '(Post missing [DwE4UPK7])');

    var pendingApprovalElem;
    var headerElem;
    var bodyElem;
    var clickToExpand;
    var clickCover;
    var extraClasses = this.props.className || '';
    var isFlat = this.props.isFlat;

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
      // (Dupl code, for anyAvatar [503KP25])
      var showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
      var author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
          store_getAuthorOrMissing(store, post);
      var anyAvatar = !showAvatar ? null : avatar.Avatar({ tiny: true, user: author });
      headerElem =
          r.div({ className: 'dw-p-hd' },
            anyAvatar,
            'Comment pending approval, posted ', timeAgo(post.createdAtMs), '.');
      extraClasses += ' dw-p-unapproved';
    }
    else {
      if (!post.isApproved) {
        var the = post.authorId === me.id ? 'Your' : 'The';
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
    }

    // For non-multireplies, we never show "In response to" for the very first reply (index 0),
    // instead we draw an arrow. For flat replies, show "In response to" inside the header instead,
    // that looks better (see PostHeader).
    var replyReceivers;
    if (!this.props.abbreviate && !isFlat && (
          this.props.index > 0 || post.multireplyPostNrs.length)) {
      replyReceivers = ReplyReceivers({ store: store, post: post });
    }

    var mark = me.marksByPostId[post.nr];
    switch (mark) {
      case YellowStarMark: extraClasses += ' dw-p-mark-yellow-star'; break;
      case BlueStarMark: extraClasses += ' dw-p-mark-blue-star'; break;
      case ManualReadMark: extraClasses += ' dw-p-mark-read'; break;
      default:
        // Don't add the below class before user specific data has been activated, otherwise
        // all posts would show a big black unread mark on page load, which looks weird.
        if (this.props.userSpecificDataAdded) {
          var autoRead = me.postIdsAutoReadLongAgo.indexOf(post.nr) !== -1;
          autoRead = autoRead || me.postIdsAutoReadNow.indexOf(post.nr) !== -1;
          if (!autoRead) {
            extraClasses += ' dw-p-unread';
          }
        }
    }

    if (isWikiPost(post))
      extraClasses += ' dw-wiki';

    if (store.pageRole === PageRole.Question && post.uniqueId === store.pageAnswerPostUniqueId)
      extraClasses += ' esP-solution';

    if (isFlat)
      extraClasses += ' dw-p-flat';

    if (post_shallRenderAsHidden(post))
      extraClasses += ' s_P-Hdn';

    var unwantedCross;
    if (post.numUnwantedVotes) {
      extraClasses += ' dw-unwanted dw-unwanted-' + post.numUnwantedVotes;
      // Sync the max limit with CSS in client/app/.debiki-play.styl. [4KEF28]
      if (post.numUnwantedVotes >= 7) {
        extraClasses += ' dw-unwanted-max';
      }
      unwantedCross = r.div({ className: 'dw-unwanted-cross' });
    }

    var id = this.props.abbreviate ? undefined : 'post-' + post.nr;

    return (
      r.div({ className: 'dw-p ' + extraClasses, id: id,
            onMouseEnter: this.props.onMouseEnter, onClick: this.onClick },
        pendingApprovalElem,
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
    var store: Store = this.props.store;
    var multireplyClass = ' dw-mrrs'; // mrrs = multi reply receivers
    var thisPost: Post = this.props.post;
    var repliedToPostIds = thisPost.multireplyPostNrs;
    if (!repliedToPostIds || !repliedToPostIds.length) {
      multireplyClass = '';
      repliedToPostIds = [thisPost.parentNr];
    }
    var receivers = [];
    for (var index = 0; index < repliedToPostIds.length; ++index) {
      var repliedToId = repliedToPostIds[index];
      if (repliedToId === NoPostId) {
        // This was a reply to the whole page, happens if one clicks the "Add comment"
        // button in the chat section, and then replies to someone too.
        continue;
      }
      var post = store.postsByNr[repliedToId];
      if (!post) {
        receivers.push(r.i({ key: repliedToId }, 'Unknown [DwE4KFYW2]'));
        continue;
      }
      var author = store_getAuthorOrMissing(store, post);
      var link =
        r.a({ href: '#post-' + post.nr, className: 'dw-rr', key: post.nr },
          author.username || author.fullName,
          // Append an up arrow to indicate that clicking the name will scroll up,
          // rather than opening an about-user dialog. ⬆ is Unicode upwards-black-arrow U+2B06.
          r.span({ className: '-RRs_RR_Aw' }, '⬆'));
      if (receivers.length) {
        link = r.span({ key: post.nr }, ' and', link);
      }
      receivers.push(link);
    }
    var elem = this.props.comma ? 'span' : 'div';
    return (
      r[elem]({ className: 'dw-rrs' + multireplyClass }, // rrs = reply receivers
        (this.props.comma ? '— i' : 'I') + 'n reply to', receivers, ':'));
  }
});



export var PostHeader = createComponent({
  onUserClick: function(event) {
    morebundle.openAboutUserDialogForAuthor(this.props.post);
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
    var store: Store = this.props;
    var post: Post = this.props.post;
    let abbreviate = this.props.abbreviate;
    if (!post)
      return r.p({}, '(Post missing [DwE7IKW2])');

    if (isWikiPost(post)) {
      if (abbreviate) {
        return r.div({ className: 'dw-p-hd' }, 'Wiki');
      }
      if (this.props.is2dTreeColumn || post.isTreeCollapsed || post.nr === BodyNr) {
        return null;
      }
      // Show a collapse button for this wiki post, but no author name because this is
      // a wiki post contributed to by everyone.
      return r.span({ className: 'dw-a-clps icon-up-open', onClick: this.onCollapseClick });
    }

    var linkFn = abbreviate ? 'span' : 'a';

    var anySolutionIcon = store.pageRole === PageRole.Question &&
        post.uniqueId === store.pageAnswerPostUniqueId
      ? r.span({ className: 'esH_solution icon-ok-circled', title: "Solution" })
      : null;

    // (Dupl code, for anyAvatar [503KP25])
    var author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
        store_getAuthorOrMissing(store, post);
    var showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
    var anyAvatar = !showAvatar ? null : avatar.Avatar({ tiny: true, user: author });

    var editInfo = null;
    if (post.lastApprovedEditAtMs) {
      var editedAt = prettyLetterTimeAgo(post.lastApprovedEditAtMs);
      //var byVariousPeople = post.numEditors > 1 ? ' by various people' : null;
      editInfo =
          r.span({ onClick: this.showEditHistory, className: 'esP_viewHist icon-edit',
              title: "Click to view old edits"},
            editedAt);
    }

    var anyPin;
    if (post.pinnedPosition) {
      anyPin =
        r[linkFn]({ className: 'dw-p-pin icon-pin' });
    }

    var postId;
    var anyMark;
    if (post.nr !== TitleNr && post.nr !== BodyNr) {
      if (debiki.debug) {
        postId = r.span({ className: 'dw-p-link' }, '#' + post.nr);
      }

      /* COULD: Later on, move the star to the right? Or to the action list? And
         to indicate that the computer has been read, paint a 3px border to the
         left of the header. And to indicate that the human has marked it as read,
         set the header's bg color to white.
      var mark = user.marksByPostId[post.nr];
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

    var isPageBody = post.nr === BodyNr;
    var by = isPageBody ? 'By ' : '';
    var isBodyPostClass = isPageBody ? ' dw-ar-p-hd' : '';

    var is2dColumn = this.props.horizontalLayout && this.props.depth === 1;
    var collapseIcon = is2dColumn ? 'icon-left-open' : 'icon-up-open';
    var isFlat = this.props.isFlat;
    var toggleCollapsedButton =
        is2dColumn || abbreviate || post.isTreeCollapsed || isPageBody || isFlat
          ? null
          : r.span({ className: 'dw-a-clps ' + collapseIcon, onClick: this.onCollapseClick });

    // For flat replies, show "In response to" here inside the header instead,
    // rather than above the header — that looks better.
    var inReplyTo;
    if (!abbreviate && isFlat && (post.parentNr || post.multireplyPostNrs.length)) {
      inReplyTo = ReplyReceivers({ store: store, post: post, comma: true });
    }

    var timeClass = 'esP_H_At';

    return (
        r.div({ className: 'dw-p-hd' + isBodyPostClass },
          anyPin,
          postId,
          anyMark,
          anySolutionIcon,
          anyAvatar,
          by,
          UserName({ user: author, makeLink: !abbreviate,
              onClick: abbreviate ? undefined : this.onUserClick }),
          // COULD add "Posted on ..." tooltip.
          this.props.exactTime ?
              timeExact(post.createdAtMs, timeClass) : timeAgo(post.createdAtMs, timeClass),
          editInfo,
          inReplyTo,
          toggleCollapsedButton,
          this.props.stuffToAppend));
  }
});


export var PostBody = createComponent({
  loadAndShow: function(event) {
    event.preventDefault();
    let post: Post = this.props.post;
    ReactActions.loadAndShowPost(post.nr);
  },

  render: function() {
    var post: Post = this.props.post;
    if (post.summarize) {
      return (
        r.div({ className: 'dw-p-bd' },
          r.div({ className: 'dw-p-bd-blk' },
            r.p({}, post.summary))));
    }
    var body;
    if (post_shallRenderAsHidden(post)) {
      body = r.div({ className: 'dw-p-bd-blk', onClick: this.loadAndShow },
        "Post hidden; click to show");
    }
    else if (this.props.abbreviate) {
      // SHOULD OPTIMIZE COULD_OPTIMIZE don't create new <div>s here over and over again.
      // COULD Rename 'length' below to maxCharsToShow?
      // Include the first maxCharsToShow chars, but don't count chars inside tags, e.g.
      // <a href="......."> because a URL can sometimes be 120 chars and then nothing
      // would be shown at all (if we counted the tokens inside the <a> tag).
      // Do this by parsing the sanitized html and then calling text().
      this.textDiv = this.textDiv || $('<div></div>');
      this.textDiv.html(post.sanitizedHtml);
      var length = Math.min(screen.width, screen.height) < 500 ? 90 : 120;
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


function horizontalCss(horizontal) {
    return horizontal ? ' dw-hz' : '';
}



// Could move elsewhere? Where?
export function makePageClosedTooltipText(pageRole: PageRole) {
  switch (pageRole) {
    case PageRole.Question:
      return "This question has been closed without any accepted answer.";
    case PageRole.ToDo:
      return "This To-Do has been closed. It probably won't be done or fixed.";
    default:
      return "This topic is closed.";
  }
}


// Could move elsewhere? Where?
export function makeQuestionTooltipText(isAnswered) {
  return isAnswered ? "This is a solved question" : "This is an unsolved question";
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
