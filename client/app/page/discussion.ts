/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../page-dialogs/open-share-popup.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="post-actions.ts" />
/// <reference path="chat.ts" />
/// <reference path="social-buttons.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const closedIcon = r.span({ className: 'icon-block' });
const questionIcon = r.span({ className: 'icon-help-circled' });
const problemIcon = r.span({ className: 'icon-attention-circled' });
const solvedIcon = r.span({ className: 'icon-ok-circled' });
const ideaIcon = r.span({ className: 'icon-idea' });
const startedIcon = r.span({ className: 'icon-check-empty' });
const plannedIcon = r.span({ className: 'icon-check-dashed' });
const doneIcon = r.span({ className: 'icon-check' });

const HelpTypePageClosed = 101;

export const TitleBodyComments = createComponent({
  displayName: 'TitleBodyComments',

  makeHelpMessage: function(): HelpMessage {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const me: Myself = store.me;
    const bodyPost = page.postsByNr[BodyNr];

    if (page.pageRole === PageRole.Form && page.pageClosedAtMs)
      return { id: 'EsH4PK04', version: 1, type: HelpTypePageClosed, content: r.div({},
        t.d.ThisFormClosed_1, closedIcon, t.d.ThisFormClosed_2) };

    const makeShareButton = (where: string) => {  // dupl code [2WUGVSF0]
      return (
        r.a({ className: 'p_ShareIcon icon-' + where,
          onClick: () =>
            pagedialogs.openSharePopup("https://usability.testing.exchange", where) }));
    };
    const shareWithFriends =
      r.div({},
        r.p({ style: { display: 'inline-block', paddingRight: 13 }},
            "Share Usability Testing Exchange with your friends?"),   // [plugin]
          r.span({ className: 's_ShareD_Social' },
            makeShareButton(pagedialogs.Facebook),
            makeShareButton(pagedialogs.Twitter),
            makeShareButton(pagedialogs.Google),
            makeShareButton(pagedialogs.LinkedIn)));

    // If this page was closed prematurely, show "... has been closed ..." instead of
    // e.g. "... is waiting for an answer..."
    const isClosedUnfinished = page.pageClosedAtMs && !page.pageDoneAtMs && !page.pageAnsweredAtMs;
    const isClosedUsabilityTesting =
        page.pageClosedAtMs && page.pageRole === PageRole.UsabilityTesting;  // [plugin]
    if (isClosedUnfinished || isClosedUsabilityTesting) {
      const closed = r.b({}, closedIcon, t.closed);
      const done = r.b({}, doneIcon, "done");
      if (page.pageRole === PageRole.UsabilityTesting)  // [plugin]
        return { id: 'Ed2PRK06', version: 1, type: HelpTypePageClosed, content: r.div({},
          r.p({}, "This topic has been ", page.pageDoneAtMs ? done : closed, ", no more feedback " +
          "needed. (But you can leave more feedback, if you want to.)"),
          shareWithFriends) };
      return { id: 'EdH7UMPW', version: 1, type: HelpTypePageClosed, content: r.div({},
          t.d.ThisTopicClosed_1, closed, t.d.ThisTopicClosed_2) };
    }


    /*
    if (store.pageLockedAtMs)
      ...

    if (store.pageFrozenAtMs)
      ...
    */

    if (page.pageRole === PageRole.Question) {
      if (page.pageAnsweredAtMs) {
        return { id: 'EsH5JV8', version: 1, content: r.div({ className: 'esHelp-solved' },
            t.d.ThisQuestSloved_1, solvedIcon, t.d.ThisQuestSloved_2) };
      }
      else {
        return { id: 'EsH2YK03', version: 1, content: r.div({},
            t.d.ThisQuestWaiting_1, questionIcon,
            t.d.ThisQuestWaiting_2, solvedIcon,
            t.d.ThisQuestWaiting_3) };
      }
    }

    if (page.pageRole === PageRole.Problem) {
      if (page.pageDoneAtMs) {
        return { id: 'EsH5GKU0', version: 1, className: 'esH_ProblemSolved', content: r.div({},
            t.d.ThisProblSolved_1, doneIcon, t.d.ThisProblSolved_2) };
      }
      else if (page.pageStartedAtMs) {
        return { id: 'EsH7BK28', version: 1, className: 's_H_ProblemStarted', content: r.div({},
            t.d.ThisProblStarted_1, startedIcon,
            t.d.ThisProblStarted_2, doneIcon,
            t.d.ThisProblStarted_3) };
      }
      else if (page.pagePlannedAtMs) {
        return { id: 'EsH2PK40', version: 1, className: 's_H_ProblemPlanned', content: r.div({},
            t.d.ThisProblPlanned_1, plannedIcon,
            t.d.ThisProblPlanned_2, startedIcon,
            t.d.ThisProblPlanned_3, doneIcon,
            t.d.ThisProblPlanned_4) };
      }
      else {
        return { id: 'EsH1WKG5', version: 1, className: 'esH_ProblemNew', content: r.div({},
            t.d.ThisProblemNew_1, problemIcon,
            t.d.ThisProblemNew_2, doneIcon,
            t.d.ThisProblemNew_3) };
      }
    }

    if (page.pageRole === PageRole.Idea) {
      if (page.pageDoneAtMs) {
        return { id: 'EsH9PK0', version: 1, content: r.div({},
            t.d.ThisIdeaDone_1, doneIcon, t.d.ThisIdeaDone_2) };
      }
      else if (page.pageStartedAtMs) {
        return { id: 'EsH2WTSK', version: 1, content: r.div({},
          t.d.ThisIdeaStarted_1, startedIcon,
          t.d.ThisIdeaStarted_2, doneIcon,
          t.d.ThisIdeaStarted_3) };
      }
      else if (page.pagePlannedAtMs) {
        return { id: 'EsH44TK2', version: 1, content: r.div({},
            t.d.ThisIdeaPlanned_1, plannedIcon,
            t.d.ThisIdeaPlanned_2, startedIcon,
            t.d.ThisIdeaPlanned_3, doneIcon,
            t.d.ThisIdeaPlanned_4) };
      }
      else {
        return { id: 'EsH4GY6Z', version: 1, content: r.div({},
            t.d.ThisIdeaNew_1, ideaIcon,
            t.d.ThisIdeaNew_2, plannedIcon,
            t.d.ThisIdeaNew_3, startedIcon,
            t.d.ThisIdeaNew_4, doneIcon,
            t.d.ThisIdeaNew_5) };
      }
    }

    if (page.pageRole === PageRole.UsabilityTesting) {  // [plugin]
      if (!me.isAuthenticated) {
        // Could explain: here someone has asked for usability testing. X people have answered,
        // see the Replies section below.
        return null;
      }
      else {
        const isPageAuthor = bodyPost.authorId === me.id;
        if (isPageAuthor) {
          if (page.numPostsRepliesSection) {
            return { id: 'EdH5P0WF2', version: 1, alwaysShow: true, content: r.div({},
              r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                "There's feedback for you"),
              r.p({}, "Look below — someone has posted feedback to you."),
              shareWithFriends) };
          }
          else {
            return { id: 'EdH5PK2W', version: 1, alwaysShow: true, className: 's_UtxHelp_HaveAsked',
              content: r.div({},
                r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                  "This task was created by you."),
                r.p({}, "You'll be notified via email, " +
                  "when someone posts feedback to you. ", r.br(),
                  "To edit the text," +
                  //"Proofread your text below, to make sure it asks for " +
                  //"the right things and is easy to understand. To edit it, " +
                  "click the edit icon (", r.span({ className: 'icon-edit' }), ") ",
                  // People only see the edit icon for the title — try to fix this, by making
                  // 'below' bold so they'll look below instead.
                  r.b({}, "below"), " your post."),
                r.p({}, "Next step:",
                  r.a({ href: '/give-me-a-task', className: 'utxGiveMeATaskL' }, "Help others"),
                  "— then you'll get more feedback, yourself.")) };
          }
        }
        else {
          function pickAnotherTask(isSkip?: boolean) {
            const skip = isSkip ? '-skip' : '';
            const title = isSkip ? "Skip this task" : "Pick another task";
            return (
              PrimaryButton({ className: 's_UtxHelp_HaveAsked_ContinueB' + skip, // dupl code (8JKWKSA1)
                  onClick: () => {
                    let tasksToSkip = getSetCookie('edCoUtxSkip');
                    tasksToSkip = (tasksToSkip || '') + page.pageId + ',';
                    getSetCookie('edCoUtxSkip', tasksToSkip);
                    location.assign('/give-me-a-task');
                  }}, title));
          }
          if (page.numPostsRepliesSection) {
            let feedbacks =
                _.filter(_.values(page.postsByNr), (post: Post) => post.parentNr === BodyNr);
            const itsFeedbackByMe =
                _.some(feedbacks, (feedback: Post) => feedback.authorId == me.id);
            if (itsFeedbackByMe) {
              return {
                id: 'EdH5P0WF2', version: 1, alwaysShow: true, content: r.div({},
                  r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                    "Done"),
                  r.p({},
                    "You have posted feedback here. Continue with another task?"),
                  pickAnotherTask()) };
            }
            else {
              return {
                id: 'EdH5P0WF2', version: 1, alwaysShow: true, content: r.div({},
                  r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                    "This task is for you"),
                  r.p({}, "Follow the instructions below. Click 'Give Feedback' to type your " +
                    "answers to the questions."),
                  r.p({},
                    "Some other people have posted feedback here already. Try not to read what " +
                    "they have written, before you compose your own feedback."),
                  pickAnotherTask(true)) };
            }
          }
          else {
            return { id: 'EdH5PK2W', version: 1, alwaysShow: true, className: 's_UtxHelp_HaveAsked',
              content: r.div({},
                r.h1({ className: 's_UtxHelp_HaveAsked_Title' },
                  "This task is for you"),
                r.p({}, "Follow the instructions below. Click 'Give Feedback' to type your " +
                  "answers to the questions."),
                pickAnotherTask(true)) };
          }
        }
      }
    }

    return null;
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;

    const anyHelpMessageData = this.makeHelpMessage();
    const anyHelpMessage = anyHelpMessageData
        ? debiki2.help.HelpMessageBox({ message: anyHelpMessageData })
        : null;

    let anyAboutCategoryClass;
    let anyAboutCategoryTitle;
    if (page.pageRole === PageRole.About) {
      anyAboutCategoryClass = 'dw-about-category';
      anyAboutCategoryTitle =
          r.h2({ className: 'dw-about-cat-ttl-prfx' }, t.d.AboutCat)
    }

    let anyTitle = null;
    let pageRole: PageRole = page.pageRole;
    if (pageRole === PageRole.CustomHtmlPage ||
        pageRole === PageRole.EmbeddedComments ||  // maybe hide via css instead? [7SFAUM2]
        store.rootPostId !== BodyNr) {
      // Show no title for the homepage — it should have its own custom HTML with
      // a title and other things.
      // Embedded comment pages have no title, only comments.
      // And show no title if we're showing a comment not the article as the root post.
    }
    else {
      anyTitle = Title({ store });
    }

    let anyPostHeader = null;
    //let anySocialLinks = null;
    if (pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.Forum ||
        pageRole === PageRole.About || pageRole === PageRole.WebPage ||
        pageRole === PageRole.SpecialContent || pageRole === PageRole.Blog ||
        pageRole === PageRole.EmbeddedComments ||  // maybe hide via css instead [7SFAUM2]
        store.rootPostId !== BodyNr) {
      // Show no author name or social links for these generic pages.
      // And show nothing if we're showing a comment not the article as the root post.
    }
    else {
      const post = page.postsByNr[store.rootPostId];
      anyPostHeader = PostHeader({ store, post });
      // anySocialLinks = SocialLinks({ socialLinksHtml: store.socialLinksHtml }); CLEAN_UP remove social links
    }

    // If the help message is important, place it below the title, and use a different
    // color (via CSS) [4JKYIXR2], so people will notice it. Page closed = important,
    // because then, writing a reply, is likely a waste of one's time.
    const helpMessageType = anyHelpMessageData ? anyHelpMessageData.type : undefined;
    const helpMessageAboveTitle = helpMessageType === HelpTypePageClosed ? null : anyHelpMessage;
    const helpMessageBelowTitle = helpMessageType === HelpTypePageClosed ? anyHelpMessage : null;

    return (
      r.div({ className: anyAboutCategoryClass },
        helpMessageAboveTitle,
        anyAboutCategoryTitle,
        r.div({ className: 'debiki dw-page' },
          anyTitle,
          anyPostHeader,
          helpMessageBelowTitle,
          //anySocialLinks,
          RootPostAndComments({ store }))));
  },
});


export const Title = createComponent({
  displayName: 'Title',

  getInitialState: function() {
    return { isEditing: false };
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
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const titlePost: Post = page.postsByNr[TitleNr];
    if (!titlePost)
      return null;

    const me: Myself = store.me;
    const isMyPage = store_thisIsMyPage(store);
    const isStaffOrMyPage: boolean = isStaff(me) || isMyPage;

    const deletedOrUnapprovedInfo = titlePost.isApproved ? false :
        r.span({ className: 'esPendingApproval' },
          page.pageDeletedAtMs ? t.d.PageDeleted : t.d.TitlePendAppr);

    // Insert the title as plain text (don't interpret any html tags — that'd let Mallory mess up
    // the formatting, even if sanitized).
    let titleText = r.span({}, titlePost.unsafeSource);

    // Make forum titles link back to the forum default view.
    if (page.pageRole === PageRole.Forum) {
      titleText = Link({ to: page.pagePath.value }, titleText);
    }

    let anyShowForumInroBtn;
    if (!this.props.hideButtons && page.pageRole === PageRole.Forum && store.hideForumIntro) {
      const introPost = page.postsByNr[BodyNr];
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

    let anyEditTitleBtn;
    if (!this.props.hideButtons && isStaffOrMyPage) {
      anyEditTitleBtn =
        r.a({ className: 'dw-a dw-a-edit icon-edit', id: 'e2eEditTitle', onClick: this.editTitle });
    }

    let contents;
    if (this.state.isEditing) {
      const editorProps = _.clone(this.props);
      editorProps.closeEditor = this.closeEditor;
      contents = morebundle.TitleEditor(editorProps);
    }
    else {
      let pinOrHiddenClass = page.pinWhere ? ' icon-pin' : '';
      if (page.pageHiddenAtMs) {
        pinOrHiddenClass = ' icon-eye-off';
      }
      let tooltip = '';
      let icon;
      // (Some dupl code, see PostActions below and isDone() and isAnswered() in forum.ts [4KEPW2]
      if (page.pageClosedAtMs && !page.pageDoneAtMs && !page.pageAnsweredAtMs) {
        icon = r.span({ className: 'icon-block' });
        tooltip = makePageClosedTooltipText(page.pageRole) + '\n';
      }
      else if (page.pageRole === PageRole.Question) {
        icon = page.pageAnsweredAtMs
            ? r.a({ className: 'icon-ok-circled dw-clickable',
                onClick: utils.makeShowPostFn(TitleNr, page.pageAnswerPostNr) })
            : r.span({ className: 'icon-help-circled' });
        tooltip = makeQuestionTooltipText(page.pageAnsweredAtMs) + ".\n";
      }
      else if (page.pageRole === PageRole.Problem || page.pageRole === PageRole.Idea ||
                page.pageRole === PageRole.ToDo || page.pageRole === PageRole.UsabilityTesting) {
        // (Some dupl code, see [5KEFEW2] in forum.ts.
        let iconClass;
        let iconTooltip;
        if (page.pageRole === PageRole.Problem || page.pageRole === PageRole.Idea) {
          if (page.pageDoneAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipProblFixed
              : t.d.TooltipDone;
            iconClass = 'icon-check';
            iconTooltip = t.d.ClickStatusNew;
          }
          else if (page.pageStartedAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipFixing
              : t.d.TooltipImplementing;
            iconClass = 'icon-check-empty';
            iconTooltip = t.d.ClickStatusDone;
          }
          else if (page.pagePlannedAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipProblPlanned
              : t.d.TooltipIdeaPlanned;
            iconClass = 'icon-check-dashed';
            iconTooltip = t.d.ClickStatusStarted;
          }
          else  {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipUnsProbl
              : t.d.TooltipIdea;
            iconClass = page.pageRole === PageRole.Problem ?
              'icon-attention-circled' : 'icon-idea';
            iconTooltip = t.d.ClickStatusPlanned;
          }
        }
        else if (page.pageRole === PageRole.UsabilityTesting) {   // [plugin]
          tooltip = page.pageDoneAtMs
              ? "This has been done. Feedback has been given.\n"
              : "Waiting for feedback.\n";
          iconClass = page.pageDoneAtMs ? 'icon-check' : 'icon-check-empty';
          iconTooltip = page.pageDoneAtMs
              ? "Click to change status to waiting-for-feedback"
              : "Click to mark as done";
        }
        else {
          // CLEAN_UP reove this [4YK0F24]? No more page type to-do?
          tooltip = page.pageDoneAtMs
              ? "This has been done or fixed.\n"
              : "This is about something to do or fix.\n";
          iconClass = page.pageDoneAtMs ? 'icon-check' : 'icon-check-empty';
          iconTooltip = page.pageDoneAtMs
              ? "Click to change status to not-yet-done"
              : "Click to mark as done";
        }
        if (!isStaffOrMyPage) iconTooltip = null;
        const clickableClass = isStaffOrMyPage ? ' dw-clickable' : '';
        const onClick = isStaffOrMyPage ? this.cycleIsDone : null;
        icon = r.span({ className: iconClass + clickableClass, onClick: onClick,
            title: iconTooltip });
      }
      else if (page.pageRole === PageRole.FormalMessage) {
        icon = r.span({ className: 'icon-mail' });
        tooltip = t.d.TooltipPersMsg;
      }
      else if (page.pageRole === PageRole.OpenChat) {
        icon = '#';
        tooltip = t.d.TooltipChat;
      }
      else if (page.pageRole === PageRole.PrivateChat) {
        icon = r.span({ className: 'icon-lock' });
        tooltip = t.d.TooltipPrivChat;
      }

      switch (page.pinWhere) {
        case PinPageWhere.Globally: tooltip += t.d.TooltipPinnedGlob; break;
        case PinPageWhere.InCategory: tooltip += t.d.TooltipPinnedCat; break;
        default:
      }

      let deletedIcon;
      if (store_isPageDeleted(store)) {
        let deletedReason = page.pageDeletedAtMs ?
            t.d.ThisPageDeleted : t.d.CatDeldPageToo;
        deletedIcon = r.span({ className: 'icon-trash', title: deletedReason });
        titleText = r.span({ className: 'esOP_title-deleted' }, titleText);
      }

      contents =
          r.div({ className: 'dw-p-bd' },
            r.div({ className: 'dw-p-bd-blk' },
              deletedOrUnapprovedInfo,
              r.h1({ className: 'dw-p-ttl' + pinOrHiddenClass, title: tooltip },
                deletedIcon,
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
/*
var SocialLinks = createComponent({
  render: function() {
    if (!this.props.socialLinksHtml)
      return null;

    // The social links config value can be edited by admins only so we can trust it.
    return (
      r.div({ dangerouslySetInnerHTML: { __html: this.props.socialLinksHtml }}));
  }
}); */


const RootPostAndComments = createComponent({
  displayName: 'RootPostAndComments',

  getInitialState: function() {
    return { showClickReplyInstead: false };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadAndShowRootPost: function(event) {
    event.preventDefault();
    const store: Store = this.props.store;
    ReactActions.loadAndShowPost(store.rootPostId);
  },

  onAfterPageReplyClick: function(event, postType: PostType) {
    // Some dupl code below. [69KFUW20]

    event.preventDefault();
    const eventTarget = event.target; // React.js will clear the field

    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const loginToWhat = page.pageRole === PageRole.EmbeddedComments ?
        LoginReason.PostEmbeddedComment : 'LoginToComment';

    login.loginIfNeededReturnToPost(loginToWhat, BodyNr, function() {
      if (this.isGone) return;
      // Toggle highlighting first, because it'll be cleared later if the
      // editor is closed, and then we don't want to toggle it afterwards.
      $h.toggleClass(eventTarget, 'dw-replying');
      if (eds.isInEmbeddedCommentsIframe) {
        window.parent.postMessage(JSON.stringify(['editorToggleReply', BodyNr]), eds.embeddingOrigin);
      }
      else {
        editor.toggleWriteReplyToPost(BodyNr, postType);
      }
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
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const postsByNr: { [postNr: number]: Post; } = page.postsByNr;
    const me = store.me;
    const rootPost: Post = postsByNr[store.rootPostId];
    if (!rootPost)
      return r.p({}, '(Root post missing, id: ' + store.rootPostId +
          ', these are present: ' + _.keys(postsByNr) + ' [DwE8WVP4])');
    const isBody = store.rootPostId === BodyNr;
    const pageRole: PageRole = page.pageRole;
    let threadClass = 'dw-t dw-depth-0' + horizontalCss(page.horizontalLayout);
    const postIdAttr = 'post-' + rootPost.nr;
    let postClass = 'dw-p';
    if (post_shallRenderAsHidden(rootPost)) postClass += ' s_P-Hdn';
    let postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t';
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    const deletedOrUnapprovedMessage = rootPost.isApproved ? false :
        r.div({ className: 'esPendingApproval' },
          page.pageDeletedAtMs ? t.d.PageDeleted : t.d.TextPendingApproval);

    let body = null;
    if (pageRole !== PageRole.EmbeddedComments) {  // maybed hide via CSS instead? [7SFAUM2]
      let bodyContent;
      if (post_shallRenderAsHidden(rootPost)) {
        bodyContent = (
            r.div({ className: 'dw-p-bd-blk esOrigPost', onClick: this.loadAndShowRootPost },
              t.d.PostHiddenClickShow));
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

    let solvedBy;
    if (page.pageRole === PageRole.Question && page.pageAnsweredAtMs) {
      // onClick:... handled in ../utils/show-and-highlight.js currently (scrolls to solution).
      solvedBy = r.a({ className: 'dw-solved-by icon-ok-circled',
          href: '#post-' + page.pageAnswerPostNr,
          onMouseEnter: () => highlightPost(page.pageAnswerPostNr, true),
          onMouseLeave: () => highlightPost(page.pageAnswerPostNr, false),
          onClick: utils.makeShowPostFn(BodyNr, page.pageAnswerPostNr) },
        t.d.SolvedClickView_1 + page.pageAnswerPostNr + t.d.SolvedClickView_2);
    }

    let anyHorizontalArrowToChildren = null;
    if (page.horizontalLayout) {
      anyHorizontalArrowToChildren =
          debiki2.renderer.drawHorizontalArrowFromRootPost(rootPost);
    }

    let repliesAreFlat = false;
    let childNrs = rootPost.childIdsSorted.concat(page.topLevelCommentIdsSorted);

    // On message pages, most likely max a few people talk — then threads make no sense.
    // On form submission pages, people don't see each others submissions, won't talk at all.
    if (page.pageRole === PageRole.FormalMessage || page.pageRole === PageRole.Form) {
      repliesAreFlat = true;
      childNrs = _.values(page.postsByNr).map((post: Post) => post.nr);
    }

    let isSquashing = false;
    let firstAppendedIndex = 0;

    const threadedChildren = childNrs.map((childNr, childIndex) => {
      if (childNr === BodyNr || childNr === TitleNr)
        return null;
      const child: Post = postsByNr[childNr];
      if (!child)
        return null; // deleted
      const isCommentOrEvent =
          child.postType === PostType.BottomComment || child.postType === PostType.MetaMessage;
      if (!isCommentOrEvent) {
        firstAppendedIndex += 1;
      }
      if (isSquashing && child.squash)
        return null;
      if (child.postType === PostType.Flat)  // could rename Flat to Comment?
        return null;
      isSquashing = false;
      const threadProps: any = { store };
      if (repliesAreFlat) threadProps.isFlat = true;
      threadProps.elemType = 'div';
      threadProps.post = child;
      threadProps.postId = childNr;  // CLEAN_UP should be .postNr. But use .post only?
      threadProps.index = childIndex;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      threadProps.is2dTreeColumn = page.horizontalLayout;
      if (child.squash) {
        isSquashing = true;
        return (
          r.li({ key: childNr },
            SquashedThreads(threadProps)));
      }
      else if (child.postType === PostType.MetaMessage) {
        return (
          r.li({ key: childNr, className: 's_w-MP' },
            MetaPost(threadProps)));
      }
      else {
        // [plugin] [utx] ----------------------------
        let pickNextTaskStuff;
        if (page.pageRole === PageRole.UsabilityTesting && me.id === child.authorId &&
            me.id !== rootPost.authorId &&
            child.postType !== PostType.BottomComment /* [2GYKFS4] */) {
          pickNextTaskStuff = debiki2.help.HelpMessageBox({ className: 's_UtxNextTask', message: {
            id: 'EdH5P0WF2', version: 1, alwaysShow: true, content: r.div({},
              r.h1({ className: 's_UtxHelp_HaveAsked_Title' }, "Done"),
              r.p({}, "You feedback is below. Continue giving feedback to others?"),
              PrimaryButton({ className: 's_UtxHelp_HaveAsked_ContinueB', // dupl code (8JKWKSA1)
                  onClick: () => {
                    let tasksToSkip = getSetCookie('edCoUtxSkip');
                    tasksToSkip = (tasksToSkip || '') + page.pageId + ',';
                    getSetCookie('edCoUtxSkip', tasksToSkip);
                    location.assign('/give-me-a-task');
                  }}, "Next task")) }});
        }
        // --/ [plugin] [utx] ------------------------
        return (
          r.li({ key: childNr },
            pickNextTaskStuff,
            Thread(threadProps)));
      }
    });

    // Draw a horizontal line above the first append-bottom comment, if there're normal
    // best-first-order comments above. And text that explains how this works.
    if (firstAppendedIndex < threadedChildren.length) {
      const line =
        r.li({ className: 's_AppendBottomDiv', key: 'ApBtmDv' },
          r.span({},
            r.span({ className: 's_AppendBottomDiv_Ar-Up' }, '➜'),
            t.d.AboveBestFirst),
          r.wbr(),
          r.span({},
            r.span({ style: { whiteSpace: 'nowrap' }},
              r.span({ className: 's_AppendBottomDiv_Ar-Down' }, '➜'),
              t.d.BelowCmtsEvents)));  // needn't mention "chronologically"?
      threadedChildren.splice(firstAppendedIndex, 0, line);
    }

    // Disable chat comments for now, they make people confused, and  [8KB42]
    // it'd be hard & take long to make them simpler to understand.
    // let hasChat = false; hasChatSection(page.pageRole);

    /*let flatComments = [];
    if (hasChat) _.each(page.postsByNr, (child: Post, childId) => {
      if (!child || child.postType !== PostType.Flat)
        return null;
      var threadProps = _.clone(store);
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

    let chatSection; /* Perhaps add back later — but probably not? [8KB42]
    if (hasChat) {
      var anyClickReplyInsteadHelpMessage = this.state.showClickReplyInstead
          ? debiki2.help.HelpMessageBox({ large: true, message: clickReplyInsteadHelpMessage })
          : null;
      chatSection =
        r.div({},
          r.div({ className: 'dw-chat-title', id: 'dw-chat' },
            page.numPostsChatSection + " chat comments"),
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

    const flatRepliesClass = repliesAreFlat ? ' dw-chat' : ''; // rename dw-chat... to dw-flat?

    const socialButtons = !store.settings.showSocialButtons ? null :
        SocialButtons(store.settings);

    const postActions = post_shallRenderAsHidden(rootPost) ? null :
         PostActions({ store, post: rootPost });

    const mayReplyToOrigPost = store_mayIReply(store, rootPost);
    const isFormalMessage = page.pageRole === PageRole.FormalMessage;

    // If direct message, use only the add-bottom-comment button. Confusing with orig reply too,
    // when in practice it also just appends to the bottom. (Direct messages = flat, not threaded.)
    // If there're no replies, also don't show an extra orig-post-reply-button. (There's already
    // a blue primary one, just below-and-to-the-right-of the orig post.)
    const skipOrigPostReplyBtn =
        isFormalMessage || !mayReplyToOrigPost ||
          _.every(threadedChildren, c => _.isEmpty(c));

    // Right now the append-bottom-comment button feels mostly confusing, on embedded comments
    // pages? UX Maybe later add back, for staff only or power users?
    const skipBottomCommentBtn = pageRole === PageRole.EmbeddedComments;

    const origPostReplyButton =
        // If mind map: Don't give people a large easily clickable button that keeps appending nodes.
        // People are supposed to think before adding new nodes, e.g. think about where to place them.
        page.pageRole === PageRole.MindMap ? null :
      r.div({ className: 's_APAs'},
        skipOrigPostReplyBtn ? null : r.a({ className: 's_APAs_OPRB ' + makeReplyBtnIcon(store),
            onClick: (event) => this.onAfterPageReplyClick(event, PostType.Normal) },
          makeReplyBtnTitle(store, rootPost, true)),
        skipBottomCommentBtn ? null : r.a({ className: 's_APAs_ACBB icon-comment-empty',
            onClick: (event) => {
              const doReply = () => this.onAfterPageReplyClick(event, PostType.BottomComment);
              // Comments always added at the bottom on formal messages; no explanation needed. [4GKWC6]
              if (isFormalMessage) {
                doReply();
              }
              else {
                morebundle.openHelpDialogUnlessHidden({ id: '5JKWS', version: 1, defaultHide: false,
                  content: rFragment({},
                    r.p({}, t.d.BottomCmtExpl_1),
                    r.p({}, t.d.BottomCmtExpl_2),
                    r.p({}, t.d.BottomCmtExpl_3)),
                  doAfter: doReply
                });
              }
            } },
          isFormalMessage ? t.d.AddComment : t.d.AddBottomComment));

    return (
      r.div({ className: threadClass },
        deletedOrUnapprovedMessage,
        body,
        solvedBy,
        socialButtons,
        postActions,
        r.div({ style: { clear: 'both' }}),
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


/*
const clickReplyInsteadHelpMessage = {
  id: 'EsH5UGPM2',
  version: 1,
  okayText: "Okay",
  content: r.span({},
    r.b({}, "If you want to reply to someone"), ", then instead click ",
    r.span({ className: 'icon-reply', style: { margin: '0 1ex' }}, "Reply"),
    " just below his/her post.")
}; */



export const MetaPost = createComponent({
  displayName: 'MetaPost',

  showAboutUser: function(event: Event) {
    // Dupl code [1FVBP4E]
    morebundle.openAboutUserDialogForAuthor(this.props.post, event.target);
    event.preventDefault();
    event.stopPropagation();
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    // These never change? Immutable?
    // Harmless BUG: Well ... yes, if the action-doer renames henself — let's ignore that for now :-P
    return false;
  },

  render: function() {
    const store: Store = this.props.store;
    const post: Post = this.props.post;
    const doer: BriefUser = store_getAuthorOrMissing(store, post);
    const doersAvatar = avatar.Avatar({ user: doer });
    const when = timeAgo(post.createdAtMs, 's_MP_At');
    // This results in e.g.:  [avatar-img] @admin_alice closed this 3 hours ago
    return (
      // UX DESIGN COULD show an action icon to the left, where the poster's avatar is shown
      // for normal posts. E.g. show a closed icon, or reopened, or topic-deleted icon.
      // But then need to know what kind of action was done.
      r.div({ className: 's_MP', id: `post-${post.nr}` },
        doersAvatar,
        UserName({ user: doer, makeLink: true, onClick: this.showAboutUser, avoidFullName: true }),
        r.span({ className: 's_MP_Text', dangerouslySetInnerHTML: { __html: post.sanitizedHtml }}),
        ' ',
        when,
        '.'));
  }
});



const SquashedThreads = createComponent({
  displayName: 'SquashedThreads',

  onClick: function() {
    debiki2.ReactActions.unsquashTrees(this.props.postId);
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const postsByNr: { [postNr: number]: Post; } = page.postsByNr;
    const post: Post = postsByNr[this.props.postId];
    const parentPost: Post = postsByNr[post.parentNr];

    const arrows = debiki2.renderer.drawArrowsFromParent(
      postsByNr, parentPost, this.props.depth, this.props.index,
      page.horizontalLayout, this.props.rootPostId, !!post.branchSideways);

    const baseElem = r[this.props.elemType];
    const depthClass = ' dw-depth-' + this.props.depth;
    const indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    const is2dColumnClass = this.props.is2dTreeColumn ? ' dw-2dcol' : '';
    const postNrDebug = debiki.debug ? '  #' + post.nr : '';

    return (
      baseElem({ className: 'dw-t dw-ts-squashed' + depthClass + indentationDepthClass +
          is2dColumnClass },
        arrows,
        r.a({ className: 'dw-x-show', onClick: this.onClick },
          t.d.ClickSeeMoreRepls + postNrDebug)));
  }
});


const Thread = createComponent({
  displayName: 'Thread',

  shouldComponentUpdate: function(nextProps, nextState) {
    const should = !nextProps.quickUpdate || !!nextProps.postsToUpdate[this.props.postId];
    return should;
  },

  onAnyActionClick: function() {
    this.refs.post.onAnyActionClick();
  },

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const postsByNr: { [postNr: number]: Post; } = page.postsByNr;
    const post: Post = postsByNr[this.props.postId];
    if (!post) {
      // This tree has been deleted.
      return null;
    }

    const parentPost = postsByNr[post.parentNr];
    const deeper = this.props.depth + 1;
    const isFlat = this.props.isFlat;
    const isMindMap = page.pageRole === PageRole.MindMap;
    const thisAndSiblingsSideways = this.props.is2dTreeColumn && isMindMap;

    // Draw arrows, but not to multireplies, because we don't know if they reply to `post`
    // or to other posts deeper in the thread.
    let arrows;
    if (!post.multireplyPostNrs.length && !isFlat) {
      arrows = debiki2.renderer.drawArrowsFromParent(
        postsByNr, parentPost, this.props.depth, this.props.index,
        page.horizontalLayout, this.props.rootPostId, thisAndSiblingsSideways);
    }

    let numDeletedChildren = 0;
    for (let i = 0; i < post.childIdsSorted.length; ++i) {
      const childId = post.childIdsSorted[i];
      if (!postsByNr[childId]) {
        numDeletedChildren += 1;
      }
    }
    let numNonDeletedChildren = post.childIdsSorted.length - numDeletedChildren;
    let childrenSideways = isMindMap && !!post.branchSideways && numNonDeletedChildren >= 2;


    let anyHorizontalArrowToChildren;
    if (childrenSideways) {
      anyHorizontalArrowToChildren =
        debiki2.renderer.drawHorizontalArrowFromRootPost(post);
    }

    let isSquashingChildren = false;

    let children = [];
    if (!post.isTreeCollapsed && !post.isTreeDeleted && !isFlat) {
      children = post.childIdsSorted.map((childId, childIndex) => {
        const child = postsByNr[childId];
        if (!child)
          return null; // deleted
        if (isSquashingChildren && child.squash)
          return null;
        if (child.postType === PostType.Flat)
          return null;
        isSquashingChildren = false;

        let childIndentationDepth = this.props.indentationDepth;
        // All children except for the last one are indented.
        let isIndented = childIndex < post.childIdsSorted.length - 1 - numDeletedChildren;
        if (!page.horizontalLayout && this.props.depth === 1) {
          // Replies to article replies are always indented, even the last child.
          isIndented = true;
        }
        if (isIndented) {
          childIndentationDepth += 1;
        }
        if (childrenSideways) {
          childIndentationDepth = 0;
        }
        const threadProps = _.clone(this.props);
        threadProps.elemType = childrenSideways ? 'div' : 'li';
        threadProps.postId = childId;
        threadProps.index = childIndex;
        threadProps.depth = deeper;
        threadProps.indentationDepth = childIndentationDepth;
        threadProps.is2dTreeColumn = childrenSideways;
        threadProps.key = childId;
        let thread;
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

    const actions = isCollapsed(post) || post_shallRenderAsHidden(post)
      ? null
      : PostActions({ store, post, onClick: this.onAnyActionClick });

    const renderCollapsed = (post.isTreeCollapsed || post.isPostCollapsed) &&
        // Don't collapse threads in the sidebar; there, comments are abbreviated
        // and rendered in a flat list.
        !this.props.abbreviate;

    const anyWrongWarning = this.props.abbreviate ? null : makeWrongWarning(post);

    const showAvatar = !renderCollapsed && this.props.depth === 1 && !this.props.is2dTreeColumn;
    const avatarClass = showAvatar ? ' ed-w-avtr' : '';
    const anyAvatar = !showAvatar ? null :
        avatar.Avatar({ user: store_getAuthorOrMissing(store, post), size: AvatarSize.Small });

    const postProps = _.clone(this.props);
    postProps.post = post;
    postProps.index = this.props.index;
    //postProps.onMouseEnter = this.onPostMouseEnter; -- but there's no onPostMouseEnter?
    postProps.ref = 'post';
    postProps.renderCollapsed = renderCollapsed;

    const baseElem = r[this.props.elemType];
    let depthClass = '';
    let indentationDepthClass = '';
    if (!isFlat) {
      depthClass = ' dw-depth-' + this.props.depth;
      indentationDepthClass = ' dw-id' + this.props.indentationDepth;
    }
    const is2dColumnClass = this.props.is2dTreeColumn ? ' dw-2dcol' : '';
    const multireplyClass = post.multireplyPostNrs.length ? ' dw-mr' : '';
    const collapsedClass = renderCollapsed ? ' dw-zd' : '';

    const branchSidewaysClass = horizontalCss(childrenSideways);

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

  let wrongWarning = null;
  const wrongness = post.numWrongVotes / (post.numLikeVotes || 1);
  // One, two, three, many.
  if (post.numWrongVotes > 3 && wrongness > 1) {
    wrongWarning =
      r.div({ className: 'esWrong esWrong-Very' },
        r.div({ className: 'esWrong_Txt icon-warning' }, t.d.ManyDisagree));
  }
  else if (wrongness > 0.33) {
    wrongWarning =
      r.div({ className: 'esWrong' },
        r.div({ className: 'esWrong_Txt icon-warning' }, t.d.SomeDisagree));
  }
  return wrongWarning;
}


export const Post = createComponent({
  displayName: 'Post',

  onUncollapseClick: function(event) {
    debiki2.ReactActions.uncollapsePost(this.props.post);
  },

  onClick: function(event) {
    const props = this.props;
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
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const post: Post = this.props.post;
    const me: Myself = store.me;
    if (!post)
      return r.p({}, '(Post missing [DwE4UPK7])');

    let pendingApprovalElem;
    let headerElem;
    let bodyElem;
    let clickToExpand;
    let clickCover;
    let extraClasses = this.props.className || '';
    const isFlat = this.props.isFlat;

    if (post.isTreeDeleted || post.isPostDeleted) {
      const what = post.isTreeDeleted ? 'Thread' : 'Comment';
      headerElem = r.div({ className: 'dw-p-hd' }, what, ' deleted');
      extraClasses += ' dw-p-dl';
    }
    else if (this.props.renderCollapsed &&
        // COULD rename isTreeCollapsed since it's not always a boolean.
        post.isTreeCollapsed !== 'Truncated') {
      // COULD remove this way of collapsing comments, which doesn't show the first line?
      // Currently inactive, this is dead code (!== 'Truncated' is always false).
      let text = this.props.is2dTreeColumn ? '' : (
          post.isTreeCollapsed ? t.d.ClickSeeMoreComments : t.d.ClickSeeThisComment);
      if (debiki.debug) text +='  #' + this.props.postId;
      const iconClass = this.props.is2dTreeColumn ? 'icon-right-open' : 'icon-down-open';
      bodyElem =
          r.span({}, text, r.span({ className: 'dw-a-clps ' + iconClass }));
      extraClasses += ' dw-zd clearfix';
    }
    else if (!post.isApproved && !post.sanitizedHtml) {
      // (Dupl code, for anyAvatar [503KP25])
      const showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
      const author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
          store_getAuthorOrMissing(store, post);
      const anyAvatar = !showAvatar ? null : avatar.Avatar({ user: author });
      headerElem =
          r.div({ className: 'dw-p-hd' },
            anyAvatar,
            t.d.CmtPendAppr, timeAgo(post.createdAtMs), '.');
      extraClasses += ' dw-p-unapproved';
    }
    else {
      if (!post.isApproved) {
        const isMine = post.authorId === me.id;
        pendingApprovalElem = r.div({ className: 'dw-p-pending-mod',
            onClick: this.onUncollapseClick }, t.d.CmtBelowPendAppr(isMine));
      }
      const headerProps = _.clone(this.props);
      headerProps.onMarkClick = this.onMarkClick;
      // For mind maps, each node is part of the article/page (rather than a comment) so skip author.
      headerElem = page.pageRole === PageRole.MindMap ? null : PostHeader(headerProps);
      bodyElem = PostBody(this.props);

      if (post.isTreeCollapsed === 'Truncated' && !this.props.abbreviate) {
        extraClasses += ' dw-x';
        clickToExpand = r.div({ className: 'dw-x-show' }, t.d.clickToShow);
        clickCover = r.div({ className: 'dw-x-cover' });
      }
    }

    // For non-multireplies, we never show "In response to" for the very first reply (index 0),
    // instead we draw an arrow. For flat replies, show "In response to" inside the header instead,
    // that looks better (see PostHeader).
    let replyReceivers;
    if (!this.props.abbreviate && !isFlat && (
          this.props.index > 0 || post.multireplyPostNrs.length)) {
      replyReceivers = ReplyReceivers({ store: store, post: post });
    }

    const mark = me.marksByPostId[post.nr];
    switch (mark) {
      case YellowStarMark: extraClasses += ' dw-p-mark-yellow-star'; break;
      case BlueStarMark: extraClasses += ' dw-p-mark-blue-star'; break;
      case ManualReadMark: extraClasses += ' dw-p-mark-read'; break;
    }

    if (isWikiPost(post))
      extraClasses += ' dw-wiki';

    if (page.pageRole === PageRole.Question && post.uniqueId === page.pageAnswerPostUniqueId)
      extraClasses += ' esP-solution';

    if (isFlat)
      extraClasses += ' dw-p-flat';

    if (post_shallRenderAsHidden(post))
      extraClasses += ' s_P-Hdn';

    let unwantedCross;
    if (post.numUnwantedVotes) {
      extraClasses += ' dw-unwanted dw-unwanted-' + post.numUnwantedVotes;
      // Sync the max limit with CSS in client/app/.debiki-play.styl. [4KEF28]
      if (post.numUnwantedVotes >= 7) {
        extraClasses += ' dw-unwanted-max';
      }
      unwantedCross = r.div({ className: 'dw-unwanted-cross' });
    }

    const id = this.props.abbreviate ? undefined : 'post-' + post.nr;

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



const ReplyReceivers = createComponent({
  displayName: 'ReplyReceivers',

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    let multireplyClass = ' dw-mrrs'; // mrrs = multi reply receivers
    const thisPost: Post = this.props.post;
    let repliedToPostIds = thisPost.multireplyPostNrs;
    if (!repliedToPostIds || !repliedToPostIds.length) {
      multireplyClass = '';
      repliedToPostIds = [thisPost.parentNr];
    }
    const receivers = [];
    for (let index = 0; index < repliedToPostIds.length; ++index) {
      const repliedToId = repliedToPostIds[index];
      if (repliedToId === NoPostId) {
        // This was a reply to the whole page, happens if one clicks the "Add comment"
        // button in the chat section, and then replies to someone too.
        continue;
      }
      const post = page.postsByNr[repliedToId];
      if (!post) {
        receivers.push(r.i({ key: repliedToId }, 'Unknown [DwE4KFYW2]'));
        continue;
      }
      const author = store_getAuthorOrMissing(store, post);
      let link =
        r.a({ href: '#post-' + post.nr, className: 'dw-rr', key: post.nr,
            onMouseEnter: () => highlightPost(post.nr, true),
            onMouseLeave: () => highlightPost(post.nr, false),
            onClick: utils.makeShowPostFn(thisPost.nr, post.nr) },
          author.username || author.fullName,
          // Append an up arrow to indicate that clicking the name will scroll up,
          // rather than opening an about-user dialog. ⬆ is Unicode upwards-black-arrow U+2B06.
          r.span({ className: '-RRs_RR_Aw' }, '⬆'));
      if (receivers.length) {
        link = r.span({ key: post.nr }, t.d._and, link);
      }
      receivers.push(link);
    }
    const elem = this.props.comma ? 'span' : 'div';
    return (
      r[elem]({ className: 'dw-rrs' + multireplyClass }, // rrs = reply receivers
        this.props.comma ? t.d.dashInReplyTo : t.d.InReplyTo, receivers, ':'));
  }
});



export const PostHeader = createComponent({
  displayName: 'PostHeader',

  onUserClick: function(event: Event) {
    // Dupl code [1FVBP4E]
    morebundle.openAboutUserDialogForAuthor(this.props.post, event.target);
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
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    let me: Myself = store.me;
    let post: Post = this.props.post;
    let abbreviate = this.props.abbreviate;
    if (!post)
      return r.p({}, '(Post missing [DwE7IKW2])');

    if (isWikiPost(post)) {
      if (abbreviate) {
        return r.div({ className: 'dw-p-hd' }, t.Wiki);
      }
      if (this.props.is2dTreeColumn || post.isTreeCollapsed || post.nr === BodyNr) {
        return null;
      }
      // Show a collapse button for this wiki post, but no author name because this is
      // a wiki post contributed to by everyone.
      return r.span({ className: 'dw-a-clps icon-up-open', onClick: this.onCollapseClick });
    }

    const linkFn = abbreviate ? 'span' : 'a';

    const anySolutionIcon = page.pageRole === PageRole.Question &&
        post.uniqueId === page.pageAnswerPostUniqueId
      ? r.span({ className: 'esH_solution icon-ok-circled', title: t.Solution })
      : null;

    // (Dupl code, for anyAvatar [503KP25])
    const author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
        store_getAuthorOrMissing(store, post);
    const showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
    const anyAvatar = !showAvatar ? null : avatar.Avatar({ user: author });

    let editInfo = null;
    if (post.lastApprovedEditAtMs) {
      const editedAt = prettyLetterTimeAgo(post.lastApprovedEditAtMs);
      //var byVariousPeople = post.numEditors > 1 ? ' by various people' : null;
      editInfo =
          r.span({ onClick: this.showEditHistory, className: 'esP_viewHist icon-edit',
              title: t.d.ClickViewEdits },
            editedAt);
    }

    let anyPin;
    if (post.pinnedPosition) {
      anyPin =
        r[linkFn]({ className: 'dw-p-pin icon-pin' });
    }

    let postId;
    if (post.nr !== TitleNr && post.nr !== BodyNr) {
      if (debiki.debug) {
        postId = r.span({ className: 'dw-p-link' }, '#' + post.nr);
      }
    }

    let bookmark; /*
    if (true) { // me.bookmarks[post.uniqueId]) {
      let starClass = ' icon-bookmark-empty';
      bookmark =
        // The outer -click makes the click area larger, because the marks are small.
        r.span({ className: 's_P_H_Bm dw-p-mark-click', onClick: this.props.onMarkClick },
          r.span({ className: 'dw-p-mark icon-bookmark' + starClass }));
    } */

    let unreadMark = !me.isLoggedIn || me_hasRead(me, post) ? null :
        r.span({ className: 's_P_H_Unr icon-circle' });

    let isPageBody = post.nr === BodyNr;
    let by = isPageBody ? t.d.By : '';
    let isBodyPostClass = isPageBody ? ' dw-ar-p-hd' : '';

    let is2dColumn = page.horizontalLayout && this.props.depth === 1;
    let collapseIcon = is2dColumn ? 'icon-left-open' : 'icon-up-open';
    let isFlat = this.props.isFlat;
    let toggleCollapsedButton =
        is2dColumn || abbreviate || post.isTreeCollapsed || isPageBody || isFlat
          ? null
          : r.span({ className: 'dw-a-clps ' + collapseIcon, onClick: this.onCollapseClick });

    // For flat replies, show "In response to" here inside the header instead,
    // rather than above the header — that looks better.
    let inReplyTo;
    if (!abbreviate && isFlat && (post.parentNr || post.multireplyPostNrs.length)) {
      inReplyTo = ReplyReceivers({ store: store, post: post, comma: true });
    }

    let timeClass = 'esP_H_At';

    return (
        r.div({ className: 'dw-p-hd' + isBodyPostClass },
          anyPin,
          postId,
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
          bookmark,
          unreadMark,
          this.props.stuffToAppend));
  }
});


// Returns the first maxCharsToShow chars, but don't count chars inside tags, e.g.
// <a href="......."> because a URL can sometimes be 120 chars and then nothing
// would be shown at all (if we counted the tokens inside the <a> tag).
// Do this by parsing the sanitized html and then calling text().
function abbreviateSanitizedHtml(html) {
  const node = $h.wrapParseHtml(html);
  const text = node.textContent;
  let startOfText = text.substr(0, abbrContentLength);
  if (startOfText.length === abbrContentLength) {
    startOfText += '....';
  }
  return startOfText.trim();
}

// UX COULD update length, if screen rotated/zoomed.
const abbrContentLength = isServerSide() ? 60 : (
    screen.height < 300 ? 60 :  // or min(width, height)?
        (Math.min(screen.width, screen.height) < 500 ? 90 : 120));


export const PostBody = createComponent({
  displayName: 'PostBody',

  loadAndShow: function(event) {
    event.preventDefault();
    let post: Post = this.props.post;
    ReactActions.loadAndShowPost(post.nr);
  },

  render: function() {
    const post: Post = this.props.post;
    if (post.summarize) {
      return (
        r.div({ className: 'dw-p-bd' },
          r.div({ className: 'dw-p-bd-blk' },
            r.p({}, post.summary))));
    }
    let body;
    if (post_shallRenderAsHidden(post)) {
      body = r.div({ className: 'dw-p-bd-blk', onClick: this.loadAndShow },
        t.d.PostHiddenClickShow);
    }
    else if (this.props.abbreviate) {
      if (this.cachedAbbrevTextSource !== post.sanitizedHtml) {
        this.cachedAbbrevText = abbreviateSanitizedHtml(post.sanitizedHtml);
        this.cachedAbbrevTextSource = post.sanitizedHtml;
      }
      body = r.div({ className: 'dw-p-bd-blk' }, this.cachedAbbrevText);
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
      return t.d.TooltipQuestClosedNoAnsw;
    case PageRole.ToDo:
      return "This To-Do has been closed. It probably won't be done or fixed.";
    default:
      return t.d.TooltipTopicClosed;
  }
}


// Could move elsewhere? Where?
export function makeQuestionTooltipText(isAnswered) {
  return isAnswered ? t.d.TooltipQuestSolved : t.d.TooltipQuestUnsolved;
}


function highlightPost(postNr: PostNr, highlightOn: boolean) {
  const postElem = $byId('post-' + postNr);
  if (highlightOn) {
    debiki2.$h.addClasses(postElem, 'dw-highlighted-multireply-hover');
  }
   else {
    debiki2.$h.removeClasses(postElem, 'dw-highlighted-multireply-hover');
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
