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
/// <reference path="../oop-methods.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="metabar.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../page-dialogs/open-share-popup.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="cats-or-home-link.ts" />
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
      let image;
      if (where === pagedialogs.Facebook) {
        // Need to follow Facebook's brand guidelines and use this image. [FBBRAND]
        image = FacebookLogoImage;
      }
      return (
        r.a({ className: 'p_ShareIcon icon-' + where,
          onClick: () =>
            pagedialogs.openSharePopup("https://usability.testing.exchange", where) }, image));
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

    let props1 = {};
    let props2 = {};
    let props3 = {};
    let props4 = {};
    const activeProps = { className: 's_Pg_TtlExpl_Active' };

    if (page.pageRole === PageRole.Question) {
      if (page.pageAnsweredAtMs) {
        props2 = activeProps;
      }
      else {
        props1 = activeProps;
      }
      return { id: 'TyH603B', version: 1, content: r.ol({ className: '' },
          r.li(props1, questionIcon, '= ' + t.pds.aQuestion),
          r.li(props2, solvedIcon, '= ' + t.pds.hasAccptAns)) };
    }

    if (page.pageRole === PageRole.Problem) {
      let doneOrSolvedText = t.done;
      let doneOrSolvedIcon = doneIcon;
      if (page.pageAnsweredAtMs) {
        doneOrSolvedText = "solved";  // I18N
        doneOrSolvedIcon = solvedIcon;  // [ans_solved_icon]
        props4 = activeProps;
      }
      else if (page.pageDoneAtMs) {
        props4 = activeProps;
      }
      else if (page.pageStartedAtMs) {
        props3 = activeProps;
      }
      else if (page.pagePlannedAtMs) {
        props2 = activeProps;
      }
      else {
        props1 = activeProps;
      }
      return { id: 'TyH5KMA2', version: 1, content: r.ol({ className: '' },
          r.li(props1, problemIcon, '= ' + t.pds.aProblem),
          r.li(props2, plannedIcon, '= ' + t.pds.planToFix),
          r.li(props3, startedIcon, '= ' + t.started),
          r.li(props4, doneOrSolvedIcon, '= ' + doneOrSolvedText)) };
    }

    if (page.pageRole === PageRole.Idea) {
      let doneOrSolved = t.done;
      if (page.pageAnsweredAtMs) {
        doneOrSolved = "solved";  // I18N
        props4 = activeProps;
      }
      else if (page.pageDoneAtMs) {
        props4 = activeProps;
      }
      else if (page.pageStartedAtMs) {
        props3 = activeProps;
      }
      else if (page.pagePlannedAtMs) {
        props2 = activeProps;
      }
      else {
        props1 = activeProps;
      }
      return { id: 'TyH4RD28', version: 1, content: r.ol({ className: '' },
          r.li(props1, ideaIcon, '= ' + t.pds.anIdea),
          r.li(props2, plannedIcon, '= ' + t.pds.planToDo),
          r.li(props3, startedIcon, '= ' + t.started),
          r.li(props4, doneIcon, '= ' + doneOrSolved)) };
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
          if (page.numRepliesVisible) {
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
          if (page.numRepliesVisible) {
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
    const me: Myself = store.me;

    const anyHelpMessageData = this.makeHelpMessage();
    const anyHelpMessage = anyHelpMessageData
        ? debiki2.help.HelpMessageBox({ message: anyHelpMessageData, className: 's_Pg_TtlExpl' })
        : null;

    let anyAboutCategoryClass;
    let anyAboutCategoryTitle;
    if (page.pageRole === PageRole.About) {
      const ancestors = page.ancestorsRootFirst;
      const parentCategory = _.last(ancestors);
      anyAboutCategoryClass = 'dw-about-category';
      anyAboutCategoryTitle =
          r.h2({ className: 'dw-about-cat-ttl-prfx' },
            "Edit the description of the ",
            r.strong({}, parentCategory.title), " category:");
    }

    const pageRole: PageRole = page.pageRole;

    // Sometimes, hide title and categories, show only replies / comments:
    // 1) Show no title or categories on custom html pages, typically a homepage or
    // landing page — such pages typically have their own custom navigation and title.
    // 2) Embedded comment pages: Show comments only — no title or orig post needed,
    // because there's a blog post above instead. Unless we're looking at the comments
    // page directly over at the Talkyard site (!store.isEmbedded). [5UKWSP4]
    // 3) Show no title if we're showing a reply, not the orig post, as the root post.
    // 4) Category description pages, for editing category descriptions,
    // have auto gen titles (`anyAboutCategoryTitle` here). [4AKBR02]
    const skipCats = (
        pageRole === PageRole.CustomHtmlPage ||
        (pageRole === PageRole.EmbeddedComments && store.isEmbedded) ||
        store.rootPostId !== BodyNr);
    const skipTitle = skipCats || pageRole === PageRole.About;

    const anyTitle = skipTitle ? null : Title({ store });
    const catsOrHomeLink = skipCats ? null : CatsOrHomeLink(page, store);

    let anyPostHeader = null;
    //let anySocialLinks = null;
    if (pageRole === PageRole.CustomHtmlPage || pageRole === PageRole.Forum ||
        pageRole === PageRole.About || pageRole === PageRole.WebPage ||
        pageRole === PageRole.SpecialContent || pageRole === PageRole.Blog ||
        (pageRole === PageRole.EmbeddedComments && store.isEmbedded) ||
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
        catsOrHomeLink,
        helpMessageAboveTitle,
        anyAboutCategoryTitle,
        r.div({ className: 'debiki dw-page', id: 't_PageContent' },
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
    return { editingPageId: null };
  },

  editTitle: function() {
    const store: Store = this.props.store;
    this.setState({ editingPageId: store.currentPageId });
  },

  closeEditor: function() {
    this.setState({ editingPageId: null });
  },

  componentDidUpdate: function() {
    const store: Store = this.props.store;
    if (this.state.editingPageId && this.state.editingPageId !== store.currentPageId) {
      this.closeEditor();
    }
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
          page.pageDeletedAtMs
                  ? t.d.PageDeld
                  : t.d.PagePendAppr || t.d.TitlePendAppr);

    // Insert the title as plain text (don't interpret any html tags — that'd let Mallory mess up
    // the formatting, even if sanitized).  [title_plain_txt]
    let titleText = r.span({}, titlePost.unsafeSource);

    // Make forum titles link back to the forum default view.
    if (page.pageRole === PageRole.Forum) {
      titleText = Link({ to: page.pagePath.value }, titleText);
    }

    let anyShowForumInroBtn;
    if (page.pageRole === PageRole.Forum && store.hideForumIntro) {
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
    if (isStaffOrMyPage) {
      anyEditTitleBtn =
        r.a({ className: 'dw-a dw-a-edit icon-edit', id: 'e2eEditTitle', onClick: this.editTitle });
    }

    let contents;
    if (this.state.editingPageId) {
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
      let iconClass = '';
      let iconTooltip = '';
      if (page_isClosedUnfinished(page)) {
        iconClass = 'icon-block';
        tooltip = makePageClosedTooltipText(page.pageRole) + '\n';
      }
      else if (page_isSolved(page)) {
        tooltip = t.d.TooltipQuestSolved + ".\n";
        iconClass = page_getSolvedIcon(page);
      }
      else if (page.pageRole === PageRole.Question) {
        // @ifdef DEBUG
        dieIf(page.pageAnsweredAtMs, 'TyE305MRKT');
        // @endif
        iconClass = 'icon-help-circled';
        tooltip = t.d.TooltipQuestUnsolved + ".\n";
      }
      else if (page_canBeDone(page)) {
        iconTooltip = t.cpd.ClickToChange;
        // (Some dupl code, see [5KEFEW2] in forum.ts.
        if (page.pageRole === PageRole.Problem || page.pageRole === PageRole.Idea) {
          if (page.pageDoneAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipProblFixed
              : t.d.TooltipDone;
            iconClass = 'icon-check';
          }
          else if (page.pageStartedAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipFixing
              : t.d.TooltipImplementing;
            iconClass = 'icon-check-empty';
          }
          else if (page.pagePlannedAtMs) {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipProblPlanned
              : t.d.TooltipIdeaPlanned;
            iconClass = 'icon-check-dashed';
          }
          else  {
            tooltip = page.pageRole === PageRole.Problem
              ? t.d.TooltipUnsProbl
              : t.d.TooltipIdea;
            iconClass = page.pageRole === PageRole.Problem ?
              'icon-attention-circled' : 'icon-idea';
          }
        }
        else if (page.pageRole === PageRole.UsabilityTesting) {   // [plugin]
          tooltip = page.pageDoneAtMs
              ? "This has been done. Feedback has been given.\n"
              : "Waiting for feedback.\n";
          iconClass = page.pageDoneAtMs ? 'icon-check' : 'icon-check-empty';
        }
        else {
          // CLEAN_UP reove this [4YK0F24]? No more page type to-do?
          tooltip = page.pageDoneAtMs
              ? "This has been done or fixed.\n"
              : "This is about something to do or fix.\n";
          iconClass = page.pageDoneAtMs ? 'icon-check' : 'icon-check-empty';
        }
        if (!isStaffOrMyPage) iconTooltip = null;
      }
      else if (page.pageRole === PageRole.FormalMessage) {
        iconClass = 'icon-mail';
        tooltip = t.d.TooltipPersMsg;
      }
      else if (page_isOpenChat(page.pageRole)) {
        iconClass = 'icon-chat';
        tooltip = t.d.TooltipChat;
      }
      else if (page.pageRole === PageRole.PrivateChat) {
        iconClass = 'icon-lock';
        tooltip = t.d.TooltipPrivChat;
      }

      switch (page.pinWhere) {
        case PinPageWhere.Globally: tooltip += t.d.TooltipPinnedGlob; break;
        case PinPageWhere.InCategory: tooltip += t.d.TooltipPinnedCat; break;
        default:
      }

      const titleIcon = !page.pageAnsweredAtMs && !isStaffOrMyPage
          ? r.span({ className: iconClass, title: iconTooltip })
          : r.a({ className: 'dw-clickable ' + iconClass, title: iconTooltip,
              onClick: event => {
                const rect = cloneEventTargetRect(event);
                morebundle.openChangePageDialog(rect, { page, showViewAnswerButton: true });
              }});

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
                titleIcon, titleText,
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
    return {
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  loadAndShowRootPost: function(event) {
    event.preventDefault();
    const store: Store = this.props.store;
    ReactActions.loadAndShowPost(store.rootPostId);  // RENAME rootPostId to rootPostNr.
  },

  onAfterPageReplyClick: function(event, postType: PostType) {
    // Some dupl code below. [69KFUW20]

    event.preventDefault();

    const store: Store = this.props.store;
    const page: Page = store.currentPage;

    const loginToWhat: LoginReason =
        postType === PostType.BottomComment
          ? LoginReason.PostProgressPost
          : (page.pageRole === PageRole.EmbeddedComments
              ? LoginReason.PostEmbeddedComment
              : LoginReason.PostReply);

    login.loginIfNeededReturnToPost(loginToWhat, BodyNr, () => {    // SSO E2E TESTS_MISSSING
      if (this.isGone) return;
      ReactActions.composeReplyTo(BodyNr, postType);
    });
  },

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
    const postNrAttr = 'post-' + rootPost.nr;
    let postClass = 'dw-p';
    if (post_shallRenderAsHidden(rootPost)) postClass += ' s_P-Hdn';
    if (post_isDeleted(rootPost)) postClass += ' s_P-Dd';
    let postBodyClass = 'dw-p-bd';
    if (isBody) {
      threadClass += ' dw-ar-t' + (rootPost.isApproved ? '' : ' s_PndApr');
      postClass += ' dw-ar-p';
      postBodyClass += ' dw-ar-p-bd';
    }

    postClass += rootPost.isPreview ? ' s_P-Prvw' : '';
    postClass += post_isWiki(rootPost) ? ' s_P-Wiki' : '';

    const isThreadedDiscussion = page_isThreadedDiscussion(page);
    const isFlatProgress = page_isFlatProgress(page);
    // @ifdef DEBUG
    dieIf(isThreadedDiscussion && isFlatProgress, 'TyE5AK40');
    // @endif

    const notYetApprovedMaybeDeletedInfo = rootPost.isApproved ? false :
         r.div({ className: 'esPendingApproval' },
           page.pageDeletedAtMs ? t.d.PageDeld : t.d.TextPendingApproval);

    const deletedCross = !page.pageDeletedAtMs ? null :
        r.div({ className: 's_Pg_DdX' });
    const deletedText = !page.pageDeletedAtMs ? null :
        r.div({ className: 's_Pg_DdInf' },
          pageRole === PageRole.EmbeddedComments ? t.d.DiscDeld : t.d.PageDeld);

    const previewInfo = !rootPost.isEditing ? null :
        r.div({ className: 's_T_YourPrvw' },
          t.e.PreviewC + ' ',
          r.span({ className: 's_T_YourPrvw_ToWho' },
            t.d.YourEdits));

    let body = null;
    if (pageRole !== PageRole.EmbeddedComments || !store.isEmbedded) {
      let bodyContent;
      if (post_shallRenderAsDeleted(rootPost) || post_shallRenderAsHidden(rootPost)) {
        const isDeleted = post_isDeleted(rootPost);
        const onClick = !isDeleted || isStaff(me) ? this.loadAndShowRootPost : undefined;
        bodyContent = (
            r.div({ className: 'dw-p-bd-blk esOrigPost', onClick },
              isDeleted
                ? (t.d.PostDeld + (isStaff(me) ? '. ' + t.ClickToShow : ''))
                : t.d.PostHiddenClickShow));
      }
      else {
        bodyContent = (
            r.div({ className: 'dw-p-bd-blk esOrigPost',
              dangerouslySetInnerHTML: { __html: rootPost.sanitizedHtml }}));
      }
      body =
        r.div({ className: postClass, id: postNrAttr },
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
          previewInfo,
          body,
          NoCommentsPageActions({ store, post: rootPost })));
    }

    let solvedBy;
    if (page_isSolved(page)) {
      // onClick:... handled in ../utils/show-and-highlight.js currently (scrolls to solution).
      const solvedIcon = page_getSolvedIcon(page);
      solvedBy = r.a({ className: 'dw-solved-by ' + solvedIcon,
          href: '#post-' + page.pageAnswerPostNr,
          onMouseEnter: () => ReactActions.highlightPost(page.pageAnswerPostNr, true),
          onMouseLeave: () => ReactActions.highlightPost(page.pageAnswerPostNr, false),
          onClick: utils.makeShowPostFn(BodyNr, page.pageAnswerPostNr) },
        t.d.SolvedClickView_1 + page.pageAnswerPostNr + t.d.SolvedClickView_2);
    }

    let anyHorizontalArrowToChildren = null;
    if (page.horizontalLayout) {
      anyHorizontalArrowToChildren =
          debiki2.renderer.drawHorizontalArrowFromRootPost(rootPost);
    }

    let backlinksElm;
    const pubLinks = page.internalBacklinks || [];
    const restrLinks = me.myCurrentPageData.internalBacklinks || [];
    const internalBacklinks: Topic[] = [...pubLinks];
    for (const restrLink of restrLinks) {
      const publLink = _.find(pubLinks, l => l.pageId === restrLink.pageId); // [On2]
      if (!publLink) {
        internalBacklinks.push(restrLink);
      }
    }
    if (nonEmpty(internalBacklinks)) {
      backlinksElm =
            r.div({ className: 's_InLns' },
              r.p({ className: 's_InLns_Ttl' }, "Linked from:"), // I18N
              r.ol({},
                internalBacklinks.map((topic: Topic) =>
                  r.li({ key: topic.pageId },
                    // UX "BUG", SHOULD: For access restricted topics, show e.g.
                    // a padlock or a private message symbol, instead of a link icon
                    // — Otherwise ppl can get nervous, when they think "everyone"
                    // can see such access restricted links.  [staff_can_see]
                    Link({ to: topic.url, className: 's_InLns_Ln icon-link' },
                      topic.title))
              )));
    }

    let repliesAreFlat = false;
    let discOrProgrReplyNrs = rootPost.childNrsSorted.concat(page.parentlessReplyNrsSorted);

    // DO_AFTER 2019-06-01 CLEAN_UP REMOVE this, because now all message page posts are ProgressPost:s,
    // so this then no longer needed. However, wait for a while, so as not to mess up any
    // discussions people are having right now (2019-04-13).
    // --------------
    // On message pages, most likely max a few people talk — then threads make no sense.
    // On form submission pages, people don't see each others submissions, won't talk at all.
    if (page.pageRole === PageRole.FormalMessage || page.pageRole === PageRole.Form) {
      repliesAreFlat = true;
      discOrProgrReplyNrs = _.values(page.postsByNr).map((post: Post) => post.nr);
    }
    // --------------

    let isSquashing = false;
    const discussionReplies = [];
    const progressPosts = [];

    addReplies(discussionReplies, discOrProgrReplyNrs, false);
    addReplies(progressPosts, page.progressPostNrsSorted, true);

    function addReplies(list: any[], replyNrs: PostNr[], inProgrSect: boolean) {
          replyNrs.forEach((childNr, childIndex) => {
      if (childNr === BodyNr || childNr === TitleNr)
        return;
      const child: Post = postsByNr[childNr];
      if (!child)
        return; // deleted
      const isProgrPost =
          child.postType === PostType.BottomComment || child.postType === PostType.MetaMessage;
      if (isProgrPost !== inProgrSect) {
        return;
      }
      if (isSquashing && child.squash)
        return;
      if (child.postType === PostType.Flat)  // could rename Flat to Comment? CLEAN_UP delete this 'if'?
        return;

      isSquashing = false;
      const threadProps: any = { store };
      if (isProgrPost || repliesAreFlat) {
        threadProps.isFlat = true;
      }

      threadProps.elemType = 'div';
      threadProps.post = child;
      threadProps.postId = childNr;  // CLEAN_UP should be .postNr. But use .post only? [349063216]
      threadProps.index = childIndex;
      threadProps.depth = 1;
      threadProps.indentationDepth = 0;
      threadProps.is2dTreeColumn = page.horizontalLayout;

      if (child.squash) {
        isSquashing = true;
        list.push(
          r.li({ key: childNr },
            SquashedThreads(threadProps)));
      }
      else if (child.postType === PostType.MetaMessage) {
        list.push(
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
        list.push(
          r.li({ key: childNr },
            pickNextTaskStuff,
            Thread(threadProps)));
      }
    })}

    /*

    Depending on if the layout is ThreadedDiscussion or FlatProgress,
    or split threaded-flat, the orig post Reply button does different things,
    and there are, or aren't, dividers above the threaded and flat page sections,
    and there're different bottom reply buttons. Here's a table:

    dsc  = threaded discussion layout (like Reddit, HackerNews, Disqus)
    prg  = flat progress layout (like phpBB, Discourse, Flarum)
    re-o = replies only
    sct  = section
    re   = reply (button title)
    ap   = the button appends comment to progress section
    id   = the button inserts comment into discussion section
    n    = no / none, don't show
    y    = yes / show
    nd   = show, no divider
    wd   = show, with a divider
    btm  = bottom

            always prg       disc layout               prg layout      split dsc-prg
                      dsc-re-o  prg-re-o both   dsc-re-o  prg-re-o both

    top re
    btn:       ap         id      id      id       ap       ap      ap    id —> ap *

    dsc sct:   n          nd      nd      nd       wd       n       wd       wd

    prg sct:   nd         n       wd      wd       wd       n       wd       wd

    btm dsc
    re btn:    n          y       y       y        n        n       n      y —> n *

    btm prg
    re btn:    y          y**     y**     y**      y        y       y     y** —> y  *


    *id —> ap, etc: The page starts in discussion mode, and then changes to progress
    mode, when the discussion phase has ended. Currently, that's when one changes
    the doingState to Started. [SPLDSCPRG]

    **y: The bottom appned-progress-reply button here has the title
         "Add progress note", and is shown just after a Reply button that
         inserts into the threaded discussion section. [ADPRGNT]

    */

    // ----- Discussion section divider  [DSCPRG]

    let discussionSectionDivider;
    let showDiscussionSectionDivider = true;

    if (page_isAlwaysFlatDiscourse(page)) {
      // Never any Discussion section on these types of pages. (E.g. direct messages)
      showDiscussionSectionDivider = false;
    }
    if (isThreadedDiscussion) {
      // There's no Progress section discussion on these pages (e.g. Question-Answers
      // or Discussion topic). Then, need not show any Discussion section title.
      showDiscussionSectionDivider = false;
    }
    if (isFlatProgress && !discussionReplies.length) {
      // People don't expect a Discussion section on these pages, and there are
      // no Discussion replies, so don't show any Discussion divider.
    }
    if (page.pageRole === PageRole.About) {
      // These pages are only for editing category descriptions.
      showDiscussionSectionDivider = false;
    }

    if (showDiscussionSectionDivider) {
      let expl: string = '';
      switch (page.pageRole) {
        case PageRole.Idea: expl = t.d.aboutThisIdea; break;
        case PageRole.Problem: expl = t.d.aboutThisProbl; break;
        // Weird disucssion title, if it's already a to-do? Skip?:
        // case PageRole.ToDo: expl = "about how to do this"; break;  I1 8N
      }
      discussionSectionDivider = rFragment({},
        r.li({ className: 's_PgSct s_PgSct-Dsc', key: 'DiscSect' },
          r.div({ className: 's_PgSct_Ttl' }, t.Discussion),
          r.div({ className: 's_PgSct_Dtl' }, expl)),
        r.li({},
          r.a({ className: 's_OpReB s_OpReB-Dsc icon-reply',
            onClick: (event) => this.onAfterPageReplyClick(event, PostType.Normal) },
          r.b({}, t.ReplyV), r.span({}, " (insert)"))));   // I18N
    }


    // ----- Progress section divider [DSCPRG]

    let progressSectionDivider;
    let showProgressSectionDivider = true;

    if (page_isAlwaysFlatDiscourse(page)) {
      // Never any Discussion section on these types of pages. (E.g. direct messages)
      // So show neither Discussion section nor Progress section dividers.
      showProgressSectionDivider = false;
    }
    if (isThreadedDiscussion && !progressPosts.length) {
      // People shouldn't expect any Progress section on these pages (e.g. a Question-Answers
      // topic or a Discussion), and there are no Progress posts, so, skip the divider.
      showProgressSectionDivider = false;
    }
    if (isFlatProgress && !discussionReplies.length) {
      // People shouldn't expect any Discussion section on this page, and there are no
      // Discussion replies, so skip the divider. (People in this community should excpect
      // only flat progress replies.)
      showProgressSectionDivider = false;
    }
    if (page.pageRole === PageRole.About) {
      showProgressSectionDivider = false;
    }

    if (showProgressSectionDivider) {
      let expl: string = '';
      switch (page.pageRole) {
        case PageRole.Idea: expl = t.d.withThisIdea; break;
        case PageRole.Problem: expl = t.d.withThisProbl; break;
        case PageRole.ToDo: expl = t.d.withThis; break;
      }
      progressSectionDivider =
        r.li({ className: 's_PgSct s_PgSct-Prg', key: 'ApBtmDv' },
          r.div({ className: 's_PgSct_Ttl' }, t.sb.Progr),   // REFACTOR I18N move from t.sb to just t ? or to t.d.Progr?
          r.div({ className: 's_PgSct_Dtl' }, expl));
    }

    const socialButtons = !store.settings.showSocialButtons ? null :
        SocialButtons(store.settings);

    const postActions = post_shallRenderAsHidden(rootPost) ? null :
         PostActions({ store, post: rootPost });


    // ----- After page actions

    const skipBottomReplyAppendBtn =
        // Skip the "Reply (apppend)" button on embedded comments pages — this far,
        // it's made people confused only. Maybe later add back, for staff only or power users?
        pageRole === PageRole.EmbeddedComments ||
        // If mind map: Don't give people a large easily clickable button that keeps appending nodes.
        // People are supposed to think before adding new nodes, e.g. think about where to place them.
        pageRole === PageRole.MindMap;

    const makeOnClick = (postType: PostType) => {
      return (event) => {
        this.onAfterPageReplyClick(event, postType);
      };
    }

    const afterPageActions = skipBottomReplyAppendBtn ? null :
      r.div({ className: 's_APAs' },
        store.isEditorOpen || !isThreadedDiscussion ? null :
          r.a({ className: 's_OpReB s_OpReB-Dsc icon-reply',
                onClick: makeOnClick(PostType.Normal) },
              r.b({}, t.ReplyV),
              // If there are progress posts above, clarify that the reply will
              // appear in the discussion section (not in the progress section).
              progressPosts.length ? r.span({}, ' (' + t.discussion + ')') : null),
        store.isEditorOpen || page.progressLayout === ProgressLayout.MostlyDisabled ? null :
          r.a({ className: 's_OpReB s_OpReB-Prg icon-reply',
            onClick: makeOnClick(PostType.BottomComment) },
              /* This no longer needed? [DSCPRG] Keep for a while if want to add back
                 some tips abou what a Progress reply is.
              const doReply = () => this.onAfterPageReplyClick(event, PostType.BottomComment);
              // Comments always added at the bottom on formal messages; no explanation needed.
              if (isFlatProgress) {
                doReply();
              }
              else {
                morebundle.openHelpDialogUnlessHidden({ id: '5JKWS', version: 1, defaultHide: false,
                  content: "... explain what a progr note is ..."
                  doAfter: doReply
                });
              } */
          isThreadedDiscussion
              ? r.span({}, t.d.AddProgrNote) // [ADPRGNT]
              : rFragment({},
                  r.b({}, t.ReplyV),
                  // If isn't a FlatProgress topic (with only Progress posts), then,
                  // clarify that this button adds the reply in the progress section.
                  isFlatProgress ? null : r.span({}, ' (' + t.progressN + ')'))));


    // ----- The reslut

    const layoutClass =
        isThreadedDiscussion ? ' s_ThrDsc' : (
            isFlatProgress ? ' s_FltPrg' : '');

    return (
      r.div({ className: threadClass + layoutClass },
        notYetApprovedMaybeDeletedInfo,
        deletedCross,
        previewInfo,
        body,
        solvedBy,
        socialButtons,
        deletedText,
        postActions,
        backlinksElm,
        debiki2.page.Metabar(),
        anyHorizontalArrowToChildren,
        // try to remove the dw-single-and-multireplies div + the dw-singlereplies class,
        // they're no longer needed.
        r.div({ className: 'dw-single-and-multireplies' },
          r.ol({ className: 'dw-res dw-singlereplies' },
            discussionSectionDivider,
            discussionReplies,
            progressSectionDivider,
            progressPosts)),
        afterPageActions,
        deletedText));
  },
});



export const MetaPost = createComponent({
  displayName: 'MetaPost',

  showAboutUser: function(event: Event) {
    // Dupl code [1FVBP4E]  — but post needed, so can lookup more by the same author,
    // by looking at hens ip & cookies.
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
    const doersAvatar = avatar.Avatar({ user: doer, origins: store });
    const when = timeAgo(post.createdAtMs, 's_MP_At');
    // This results in e.g.:  [avatar-img] @admin_alice closed this 3 hours ago
    return (
      // UX DESIGN COULD show an action icon to the left, where the poster's avatar is shown
      // for normal posts. E.g. show a closed icon, or reopened, or topic-deleted icon.
      // But then need to know what kind of action was done.
      r.div({ className: 's_MP', id: `post-${post.nr}` },
        doersAvatar,
        UserName({ user: doer, store, makeLink: true, onClick: this.showAboutUser, avoidFullName: true }),
        r.span({ className: 's_MP_Text', dangerouslySetInnerHTML: { __html: post.sanitizedHtml }}),
        ' ',
        when,
        '.'));
  }
});



const SquashedThreads = createComponent({
  displayName: 'SquashedThreads',

  render: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const postsByNr: { [postNr: number]: Post; } = page.postsByNr;
    const post: Post = this.props.post;
    const postNr = post.nr;
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
        r.a({ className: 'dw-x-show s_X_Show-PostNr-' + postNr,
            onClick: () => debiki2.ReactActions.unsquashTrees(postNr) },
          t.d.ClickSeeMoreRepls + ' ...' + postNrDebug)));   // [306UDRPJ24]
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

  resumeDraft: function(event) {
    const post: Post = this.props.post;
    event.preventDefault();
    // This will load our new reply draft text.
    // Let the reply be of the same post type as the post we're replying to. [REPLTYPE]
    ReactActions.composeReplyTo(post.parentNr, post.postType);
  },

  askDeleteDraft: function(event) {
    event.preventDefault();
    const store: Store = this.props.store;
    const draftPost: Post = this.props.post;
    morebundle.openDefaultStupidDialog({
      body: t.d.DelDraft + '?',
      primaryButtonTitle: t.upp.YesDelete,
      secondaryButonTitle: t.NoCancel,
      small: true,
      onPrimaryClick: () => {
        ReactActions.deleteDraftPost(store.currentPageId, draftPost);
      },
    });
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
    const thisAndSiblingsSideways: boolean = this.props.is2dTreeColumn && isMindMap;

    // Draw arrows, but not to multireplies, because we don't know if they reply to `post`
    // or to other posts deeper in the thread.
    let arrows;
    if (!post.multireplyPostNrs.length && !isFlat) {
      arrows = debiki2.renderer.drawArrowsFromParent(
        postsByNr, parentPost, this.props.depth, this.props.index,
        page.horizontalLayout, this.props.rootPostId, thisAndSiblingsSideways);
    }

    let numDeletedChildren = 0;
    for (let i = 0; i < post.childNrsSorted.length; ++i) {
      const childNr = post.childNrsSorted[i];
      if (!postsByNr[childNr]) {
        numDeletedChildren += 1;
      }
    }
    let numNonDeletedChildren = post.childNrsSorted.length - numDeletedChildren;
    let childrenSideways = isMindMap && !!post.branchSideways && numNonDeletedChildren >= 2;


    let anyHorizontalArrowToChildren;
    if (childrenSideways) {
      anyHorizontalArrowToChildren =
        debiki2.renderer.drawHorizontalArrowFromRootPost(post);
    }

    let isSquashingChildren = false;

    let children = [];
    if (!post.isTreeCollapsed && !post.isTreeDeleted && !isFlat) {
      children = post.childNrsSorted.map((childNr, childIndex) => {
        const child = postsByNr[childNr];
        if (!child)
          return null; // deleted
        if (isSquashingChildren && child.squash)
          return null;
        if (child.postType === PostType.Flat)
          return null;
        isSquashingChildren = false;

        let childIndentationDepth = this.props.indentationDepth;
        // All children except for the last one are indented.
        let isIndented = childIndex < post.childNrsSorted.length - 1 - numDeletedChildren;
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
        threadProps.post = child;
        threadProps.postId = childNr;   // CLEAN_UP should be .postNr. But use .post only? [349063216]
        threadProps.index = childIndex;
        threadProps.depth = deeper;
        threadProps.indentationDepth = childIndentationDepth;
        threadProps.is2dTreeColumn = childrenSideways;
        threadProps.key = childNr;
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
          thread = r.li({ key: childNr }, thread);
        }
        return thread;
      });
    }

    const actions = post_isCollapsed(post) || post_shallRenderAsHidden(post)
      ? null
      : PostActions({ store, post, onClick: this.onAnyActionClick });

    const renderCollapsed = (post.isTreeCollapsed || post.isPostCollapsed) &&
        // Don't collapse threads in the sidebar; there, comments are abbreviated
        // and rendered in a flat list.
        !this.props.abbreviate;

    const anyWrongWarning = this.props.abbreviate ? null : makeWrongWarning(post);

    // (Show avatar also if collapsed, otherwise messes up indentation.)
    const showAvatar = this.props.depth === 1
        && !this.props.is2dTreeColumn && !post.isForDraftNr;

    const avatarClass = showAvatar ? ' ed-w-avtr' : '';
    const anyAvatar = !showAvatar ? null :
        avatar.Avatar({ user: store_getAuthorOrMissing(store, post),
            origins: store, size: AvatarSize.Small });

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

    let replyingToElem;
    if (store_isReplyingTo(store, post)) {
      replyingToElem = r.div({ className: 's_T_ReTo' },
        r.span({ className: 's_T_ReTo_Ttl' },
          t.d.ReplyingToC),  // [305KTJ4]
        me_uiPrefs(store.me).inp === UiPrefsIninePreviews.Skip ? null :
          r.span({ className: 's_T_ReTo_Prvw' },
            t.d.ScrollToPrevw_1,
            r.a({ className: 's_T_ReTo_Prvw_B',
                onMouseEnter: () => ReactActions.highlightPreview(true),
                onMouseLeave: () => ReactActions.highlightPreview(false),
                onClick: () => ReactActions.scrollToPreview({}) },
              t.d.ScrollToPrevw_2,
                  r.span({ className: 's_T_ReTo_Prvw_B_Arw' }, " ⬇️")),
            ));
    }

    let previewClass = '';
    let previewElem;
    if (post.isPreview) {
      // For now,
      // construct either this text:  "Preview: Your reply to (someone's name):"
      // or this:   "Your draft, replies to [link to parent post]:".

      const isProgrPost = post.parentNr === BodyNr && post.postType === PostType.BottomComment;
      const yourWhat = post.isEditing
          ? t.e.PreviewC + ' '
          : t.d.YourDraft + ', ';  // [03RKTG42]

      const isEditingExistingPost = post.nr >= MinRealPostNr;

      let toWho;
      if (isEditingExistingPost) {
        // @ifdef DEBUG
        dieIf(!post.isEditing, 'TyE396KRTTF2J');
        // @endif
        toWho =
            r.span({ className: 's_T_YourPrvw_ToWho' },
              t.d.YourEdits);
      }
      else if (!post.isEditing && isProgrPost) {
        toWho =
            r.span({ className: 's_T_YourPrvw_ToWho' },
              t.d.aProgrNote);
      }
      else if (!parentPost) {
        // @ifdef DEBUG
        die("No parent post [TyE602FKDJDK]");
        // @endif
        0;
      }
      else {
        const repliesToBlogPost =
            parentPost.nr === BodyNr && page.pageRole === PageRole.EmbeddedComments;
        const replTo: false | Participant = !isProgrPost && !repliesToBlogPost &&
            store.usersByIdBrief[parentPost.authorId];
        const yourReplyTo_or_repliesTo = post.isEditing
            ? (isProgrPost
                ? t.d.YourProgrNoteC
                : t.d.YourReplyTo)
            : (isProgrPost
                ? ''  // doesn't really reply to anyone in particular
                : t.d.repliesTo);
        toWho = !replTo ? null :
            r.span({ className: 's_T_YourPrvw_ToWho' },
              yourReplyTo_or_repliesTo + ' ',
              RepliesToArrow({ post: parentPost, thisPost: post, author: replTo }), ': ');
      }

      const resumeDraftBtn = post.isEditing || store.isEditorOpen ? null :
            Button({ onClick: this.resumeDraft, className: 's_T_YourPrvw_ResumeB e_RsmDft' },
              t.d.ResumeEdting);

      const deleteDraftBtn = post.isEditing || store.isEditorOpen ? null :
            Button({ onClick: this.askDeleteDraft,
                  className: 's_T_YourPrvw_ResumeB e_DelDft' },
              t.d.DelDraft);

      previewElem = r.div({ className: 's_T_YourPrvw' },
          yourWhat, toWho, resumeDraftBtn, deleteDraftBtn);
      previewClass = ' s_T-Prvw ' +
          (post.isEditing ? 's_T-Prvw-IsEd' : 's_T-Prvw-NotEd') +
          (post.nr >= MinRealPostNr ? ' s_P-Prvw-Real' : '');
    }

    const flatClass = isFlat ? ' s_T-Flat' : '';

    return (
      baseElem({ className: 'dw-t' + depthClass + indentationDepthClass + multireplyClass +
          is2dColumnClass + branchSidewaysClass + collapsedClass + avatarClass +
          previewClass + flatClass },
        arrows,
        replyingToElem,
        anyWrongWarning,
        previewElem,
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
      return r.p({}, '(Post missing [TyE0POST])');

    let pendingApprovalElem;
    let headerElem;
    let bodyElem;
    let clickToExpand;
    let clickCover;
    let extraClasses = this.props.className || '';
    const isFlat = this.props.isFlat;

    extraClasses += post.isPreview ? ' s_P-Prvw' : '';
    extraClasses += post_isWiki(post) ? ' s_P-Wiki' : '';

    if (post.isPreview && !post.isEditing) {
      // This sohuld be a draft of a new reply.
      // Skip header and avatar. "Your draft:"  should be enough. [03RKTG42]
      // @ifdef DEBUG
      // The post doesn't yet exist, shouldn't have a real post nr.
      dieIf(post.nr > MaxVirtPostNr, 'TyE50SKRPJAECW2');
      // @endif
      bodyElem = PostBody(this.props);
      extraClasses += ' s_P-Prvw-NotEd';
    }
    else if (post_isDeleted(post)) {
      headerElem = r.div({ className: 'dw-p-hd' }, post.isTreeDeleted ? t.d.ThreadDeld : t.d.CmntDeld);
      extraClasses += ' s_P-Dd';
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
    else if (!post.isApproved && !post.sanitizedHtml && !post.isPreview) {
      // (Dupl code, for anyAvatar [503KP25])
      const showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
      const author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
          store_getAuthorOrMissing(store, post);
      const anyAvatar = !showAvatar ? null : avatar.Avatar({ user: author, origins: store });
      headerElem =
          r.div({ className: 'dw-p-hd' },
            anyAvatar,
            t.d.CmtPendAppr, timeAgo(post.createdAtMs), '.');
      extraClasses += ' dw-p-unapproved';
    }
    else {
      if (post.isPreview) {
        // @ifdef DEBUG
        dieIf(!post.isEditing, 'TyE305RDHGR2');
        // @endif
        extraClasses += ' s_P-Prvw-IsEd' + (
            post.nr >= MinRealPostNr ? ' s_P-Prvw-Real' : '');
      }
      else if (!post.isApproved) {
        const isMine = post.authorId === me.id;
        pendingApprovalElem = r.div({ className: 'dw-p-pending-mod',
            onClick: this.onUncollapseClick },
          t.d.CmtBelowPendAppr(isMine));
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
    let repliedToPostNrs = thisPost.multireplyPostNrs;
    if (!repliedToPostNrs || !repliedToPostNrs.length) {
      multireplyClass = '';
      repliedToPostNrs = [thisPost.parentNr];
    }
    const receivers = [];
    for (let index = 0; index < repliedToPostNrs.length; ++index) {
      const repliedToNr = repliedToPostNrs[index];
      if (repliedToNr === NoPostId) {
        // This was a reply to the whole page, happens if one clicks the "Add comment"
        // button in the chat section, and then replies to someone too.
        continue;
      }
      if (repliedToNr === BodyNr && eds.isInEmbeddedCommentsIframe) {
        // We're replying to the blog article. There's a dummy orig post by the
        // System user — don't show "in reply to System":
        continue;
      }
      const post = page.postsByNr[repliedToNr];
      if (!post) {
        receivers.push(r.i({ key: repliedToNr }, 'Unknown [DwE4KFYW2]'));
        continue;
      }
      const author = store_getAuthorOrMissing(store, post);
      let link = RepliesToArrow({ post, thisPost, author });
      if (receivers.length) {
        link = r.span({ key: post.nr }, t.d._and, link);
      }
      receivers.push(link);
    }
    const elem = this.props.comma ? 'span' : 'div';
    return (
      r[elem]({ className: 'dw-rrs' + multireplyClass }, // rrs = reply receivers
        this.props.comma ? t.d.repliesTo : t.d.InReplyTo, receivers, ':'));
  }
});


function RepliesToArrow(
    { post, thisPost, author }: { post: Post, thisPost: Post, author: BriefUser }) {
  return (
    r.a({ href: '#post-' + post.nr, className: 'dw-rr', key: post.nr,
        onMouseEnter: () => ReactActions.highlightPost(post.nr, true),
        onMouseLeave: () => ReactActions.highlightPost(post.nr, false),
        onClick: utils.makeShowPostFn(thisPost.nr, post.nr) },
      author.username || author.fullName,
      // Append an up arrow to indicate that clicking the name will scroll up,
      // rather than opening an about-user dialog. ⬆ is Unicode upwards-black-arrow U+2B06.
      r.span({ className: 's_RRs_RR_Aw' }, '⬆')));
}


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
    morebundle.openEditHistoryDialog(this.props.post.uniqueId);
  },

  render: function() {
    const props = this.props;
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const me: Myself = store.me;
    const post: Post = this.props.post;
    const abbreviate = this.props.abbreviate;
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

    const anySolutionIcon = page_canBeSolved(page) &&
        post.uniqueId === page.pageAnswerPostUniqueId
      ? r.span({ className: 'esH_solution icon-ok-circled', title: t.Solution })
      : null;

    // (Dupl code, for anyAvatar [503KP25])
    const author: BriefUser = this.props.author || // author specified here: [4WKA8YB]
        store_getAuthorOrMissing(store, post);
    const showAvatar = this.props.depth > 1 || this.props.is2dTreeColumn;
    const anyAvatar = !showAvatar ? null : avatar.Avatar({ user: author, origins: store });

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

    let hashPostNr;
    if (post.nr !== TitleNr && post.nr !== BodyNr) {
      if (debiki.debug) {
        hashPostNr = r.span({ className: 'dw-p-link' }, '#' + post.nr);
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

    const unreadMark = !me.isLoggedIn || me_hasRead(me, post) ? null :
        r.span({ className: 's_P_H_Unr icon-circle' });

    const isPageBody = post.nr === BodyNr;

    const by = isPageBody ? r.span({ className: 'n_By' }, t.d.By) : '';
    const userName =
        UserName({ user: author, store, makeLink: !abbreviate,
            onClick: abbreviate ? undefined : this.onUserClick });

    const isBodyPostClass = isPageBody ? ' dw-ar-p-hd' : '';

    const is2dColumn = page.horizontalLayout && this.props.depth === 1;
    const collapseIcon = is2dColumn ? 'icon-left-open' : 'icon-up-open';
    const isFlat = this.props.isFlat;
    const toggleCollapsedButton =
        is2dColumn || abbreviate || post.isTreeCollapsed || isPageBody || isFlat
          ? null
          : r.span({ className: 'dw-a-clps ' + collapseIcon, onClick: this.onCollapseClick });

    // For flat replies, show "In response to" here inside the header instead,
    // rather than above the header — that looks better.
    let inReplyTo;
    if (abbreviate) {
       // We'd like to show as little as possible: just an excerpt. So skip "replies to".
    }
    else if (!isFlat) {
      // An arrow already shows what this post replies to.
    }
    else if (
        // If replying to the orig post, that's the "default" thing to do, so then
        // don't shwo any "replies to" text.
        (post.parentNr && post.parentNr != BodyNr) || post.multireplyPostNrs.length) {
      inReplyTo = ReplyReceivers({ store, post, comma: true });
    }

    // Maybe always add these classes, in TagList() instead?  [alw_tag_type]
    const patTagList: RElm | U =
            TagList({ className: 'n_TagL-Pat', forPat: author, store });
    const postTagList: RElm | U =
            TagListLive({ className: 'n_TagL-Po', forPost: post, store, live: props.live });

    const timeClass = 'esP_H_At';

    return (r.div({ className: 'dw-p-hd' + isBodyPostClass },
        r.span({ className: 'n_ByAt'},
          anyPin,
          hashPostNr,
          anySolutionIcon,
          anyAvatar,
          by,
          userName,
          patTagList,
          // COULD add "Posted on ..." tooltip.
          r.span({ className: 'n_EdAt'},
            post.isPreview ? null : (
              this.props.exactTime ?
                timeExact(post.createdAtMs, timeClass) : timeAgo(post.createdAtMs, timeClass)),
            editInfo),
          inReplyTo,
          toggleCollapsedButton,
          bookmark,
          unreadMark,
          this.props.stuffToAppend,
          ),
        postTagList,
        ));
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

    // @ifdef DEBUG
    // There should be something to see, unless the post is hidden or not yet
    // approved. (We do load unapproved posts [show_empty_unapr]
    // and show "placeholders" indicating that there is a post, and that it's
    // not yet approved — but not who wrote it or its contents.)
    dieIf(post.isApproved &&
          !post.isBodyHidden &&
          !post_isDeletedOrCollapsed(post) &&
          isNullOrUndefined(post.sanitizedHtml) &&
          isNullOrUndefined(post.unsafeSource),
          `No post.sanitizedHtml or unsafeSource: ${toStr(post)} [TyE35RK3JH5]`);

    dieIf(post.isForDraftNr && isNullOrUndefined(post.unsafeSource), 'TyE2KSTH047A');
    dieIf(post.isEditing && isNullOrUndefined(post.sanitizedHtml), 'TyE8WT6SR2T');
    dieIf(post.summarize && isNullOrUndefined(post.summary), 'TyE75FKDTT035');
    // @endif

    if (post.summarize) {
      return (
        r.div({ className: 'dw-p-bd' },
          r.div({ className: 'dw-p-bd-blk' },
            r.p({}, post.summary))));
    }

    if (post.isPreview && post.isForDraftNr && !post.isEditing) {
      return r.pre({ className: 's_P_Prvw' },
        post.unsafeSource);  // [DFTSRC]
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
