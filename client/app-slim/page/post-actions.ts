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
/// <reference path="../store-getters.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/DropdownModal.ts" />
/// <reference path="../util/ExplainingDropdown.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../page-methods.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../links.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../login/login-if-needed.ts" />
/// <reference path="chat.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;

let moreVotesDropdownModal;
let moreDialog;


export function openMoreVotesDropdown(post: Post, votesButton) {
  if (!moreVotesDropdownModal) {
    moreVotesDropdownModal = ReactDOM.render(MoreVotesDropdownModal(), utils.makeMountNode());
  }
  moreVotesDropdownModal.openForAt(post, votesButton);
}


export function openMoreDropdown(store, post, moreButton) {
  if (!moreDialog) {
    moreDialog = ReactDOM.render(MoreDropdownModal(), utils.makeMountNode());
  }
  moreDialog.openForAt(store, post, moreButton);
}


export const NoCommentsPageActions = createComponent({
  displayName: 'NoCommentsPageActions',

  onEditClick: function(event) {
    ReactActions.editPostWithNr(this.props.post.nr);
  },

  render: function() {
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const page: Page = store.currentPage;
    const post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    // Staff may edit Info Pages — other not-a-discussion pages are only
    // editable by admins.  This will be configurable, later. [infopage_perms]
    const isInfoPageMayEdit = page.pageRole === PageRole.WebPage && isStaff(me);
    if (!isInfoPageMayEdit && !me.isAdmin)
      return null;

    // Dupl code [305RKTDJ2]
    const myPageData: MyPageData = me.myCurrentPageData;
    const anyEditsDraft = _.find(myPageData.myDrafts, (d: Draft) => {
      return d.forWhat.postId === post.uniqueId && 
          d.forWhat.draftType === DraftType.Edit;
    });
    const unfinEditsClass = anyEditsDraft ? ' s_UnfinEd' : '';

    const spaceWiki = post_isWiki(post) ? " Wiki" : ''; // I18N

    const editBtn = store.isEditorOpen ? null :
        r.a({ className: 'dw-a dw-a-edit icon-edit' + unfinEditsClass, onClick: this.onEditClick },
          t.EditV + spaceWiki + (
            anyEditsDraft ? " — " + t.d.UnfinEdits : ''));  // [UFINEDT]

    const actions = editBtn;

    return (
      r.div({ className: 'dw-p-as dw-as' }, actions));
  }
});


function makeReplyBtnIcon(store: Store) {
  const page: Page = store.currentPage;
  return page.pageRole === PageRole.MindMap ? 'icon-plus' : 'icon-reply';
     // icon-comment if blog post?
}


function makeReplyBtnTitle(store: Store, post: Post) {
  const page: Page = store.currentPage;
  if (post.nr !== BodyNr) {
    if (page.pageRole === PageRole.MindMap)
      return "Add node";
    else
      return t.ReplyV;
  }

  if (page.origPostReplyBtnTitle)
    return page.origPostReplyBtnTitle;

  switch (page.pageRole) {
    case PageRole.Critique: return "Give Critique"; // [plugin]
    case PageRole.UsabilityTesting: return "Give Feedback"; // [plugin]
    case PageRole.MindMap: return "Add Mind Map node";
    case PageRole.EmbeddedComments: return t.AddComment || t.ReplyV;  // I18N t.AddComment missing
    default:
      return rFragment({},
        r.b({}, t.ReplyV),
          page.pageLayout !== TopicLayout.SplitDiscussionProgress ? null : r.span({},
            // This page has both a discussion and a progress section, so clarify
            // in which section the reply gets addded.  [SPLDSCPRG]
            ' (' + (
                page.doingStatus >= PageDoingStatus.Started ?
                    t.progressN : t.discussion) + ')'));
  }
}


export const PostActions = createComponent({
  displayName: 'PostActions',

  onAcceptAnswerClick: function(event: MouseEvent) {
    const atRect: Rect = cloneEventTargetRect(event);
    // A [pick_persona_click_handler] could save a few lines of code?
    morebundle.chooseEditorPersona({ store: this.props.store, atRect, isInstantAction: true },
            (doAsOpts: DoAsAndOpts) => {
      const pageId = Server.getPageId();
      const postId = this.props.post.uniqueId;
      ReactActions.acceptAnswer({ pageId, postId, doAsAnon: doAsOpts.doAsAnon });
    });
  },

  onUnacceptAnswerClick: function(event: MouseEvent) {
    const atRect: Rect = cloneEventTargetRect(event);
    morebundle.chooseEditorPersona({ store: this.props.store, atRect, isInstantAction: true },
            (doAsOpts: DoAsAndOpts) => {
      const pageId = Server.getPageId();
      ReactActions.unacceptAnswer({ pageId, doAsAnon: doAsOpts.doAsAnon });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onReplyClick: function(event) {
    // Some dupl code below. [69KFUW20]

    event.preventDefault();
    const eventTarget = event.target; // React.js will clear the field

    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const post: Post = this.props.post;

    let newPostType: PostType;
    if (page_isAlwaysFlatDiscourse(page)) {
      newPostType = PostType.BottomComment;
    }
    else if (post.nr === BodyNr) {
      // This orig post reply button does different things (inserts the reply, or appends
      // the reply), depending on if the page layout is threaded or flat.
      if (page_isThreadedDiscussion(page)) {
        newPostType = PostType.Normal;
      }
      else if (page_isFlatProgress(page)) {
        newPostType = PostType.BottomComment;
      }
      else {
        // If the page has both a discussion and a progress section, and
        // the page (idea/problem) has been started, then, append replies to
        // the flat progress section. Otherwise, insert into the discussion section.
        newPostType = page.pageLayout === TopicLayout.SplitDiscussionProgress &&
                      page.doingStatus >= PageDoingStatus.Started  // [SPLDSCPRG]
            ? PostType.BottomComment  // progress reply
            : PostType.Normal;        // discussion reply
      }
    }
    else {
      // Use the same type as the post we're replying to. [REPLTYPE]
      newPostType = (post.postType === PostType.Flat || post.postType === PostType.BottomComment)
          ? post.postType
          : PostType.Normal;
    }

    const loginToWhat = page.pageRole === PageRole.EmbeddedComments ?
        LoginReason.PostEmbeddedComment : LoginReason.PostReply;

    login.loginIfNeededReturnToPost(loginToWhat, post.nr, () => {
      if (this.isGone) return;
      ReactActions.composeReplyTo(post.nr, newPostType);
    }, true);
  },

  onEditClick: function() {
    ReactActions.editPostWithNr(this.props.post.nr);
  },
  onLinkClick: function(event: MouseEvent) {
    morebundle.openShareDialog(this.props.post, event.target);
  },
  onLikeClick: function(event: MouseEvent) {
    const atRect = cloneEventTargetRect(event);
    const store: Store = this.props.store;
    const post: Post = this.props.post;
    login.loginIfNeededReturnToPost(LoginReason.LoginToLike, post.nr, () => {
      if (this.isGone) return;
      const toggleOn = !me_hasVoted(store.me, post.nr, PostVoteType.Like);
      toggleVote(this.props.store, post, PostVoteType.Like, toggleOn, atRect);
    });
  },

  openMoreVotesDropdown: function(event: MouseEvent) {
    openMoreVotesDropdown(this.props.post, event.target);
  },

  openMoreDropdown: function(event: MouseEvent) {
    openMoreDropdown(this.props.store, this.props.post, event.target);
  },

  render: function() {
    const store: Store = this.props.store;
    const post: Post = this.props.post;
    const page: Page = store.currentPage;
    const isThisPageDeleted = !!page.pageDeletedAtMs;  // ignore deleted categories
    const canBeSolved = page_canBeSolved(page);
    const isEmbeddedComments = page.pageRole === PageRole.EmbeddedComments;

    const me: Me = store.me;
    const myPageData: MyPageData = me.myCurrentPageData;
    const isOwnPost = pat_isAuthorOf(me, post, store.usersByIdBrief);
    const isOwnPage = store_thisIsMyPage(store);
    const isPageBody = post.nr === BodyNr;
    const myVotes: Vote[] = myPageData.votesByPostNr[post.nr] || [];
    const isStaffOrOwnPage: Bo = isStaff(me) || isOwnPage;
    // Later, will use the upcoming [alterPage] permission instead.
    const isCoreOrOwnPage = isStaffOrOwnPage ||
                                user_isTrustMinNotThreat(me, TrustLevel.CoreMember);
    const isEmbeddedOrigPost = isPageBody && store.isEmbedded;

    const isDeleted = post_isDeleted(post);
    const isCollapsed = post_isCollapsed(post);

    const deletedOrCollapsed = isDeleted || isCollapsed;

    if (post.nr < MinRealPostNr) {
      // This is a preview of a new reply; it doesn't yet exist for real, there's nothing
      // we can do with it.  (Later: What if one wants to e.g. schedule the post to get
      // posted a bit later, then maybe there could be a button for that, here?
      // Or change background color, or whatever — maybe some action buttons can
      // make sense, also for a preview post?)
      // @ifdef DEBUG
      dieIf(!post.isPreview, 'TyE603WKGU42R');
      // @endif
      return null;
    }

    const isEditingThisPost = post.isEditing;
    const isEditorOpenAlready = store.isEditorOpen;

    // (Do return a <div> so there'll be some whitespace below for arrows to any replies.)
    if (post_shallRenderAsDeleted(post) || isCollapsed)
      return r.div({ className: 'dw-p-as dw-as' });

    let acceptAnswerButton;
    if (deletedOrCollapsed) {
      // Show no accept-as-answer button.
      // (But if is edits preview? Then it's ok click Accept, whilst editing.)
    }
    else if (isCoreOrOwnPage && canBeSolved && !page.pageAnsweredAtMs &&
        !page.pageClosedAtMs && !isPageBody && post.isApproved) {
      const icon = page_getUnsolvedIcon(page);
      acceptAnswerButton = r.a({ className: `dw-a dw-a-solve ${icon}`,
          onClick: this.onAcceptAnswerClick, title: t.pa.AcceptBtnExpl }, t.pa.SolutionQ);
    }
    else if (canBeSolved && post.uniqueId === page.pageAnswerPostUniqueId) {
      // (Do this even if !post.isApproved.)
      const solutionTooltip = isCoreOrOwnPage
          ? t.pa.ClickUnaccept
          : t.pa.PostAccepted;
      const elemType = isCoreOrOwnPage ? 'a' : 'span';
      const unsolveClass = isCoreOrOwnPage ? ' dw-a-unsolve' : '';
      const solvedIcon = page_getSolvedIcon(page);
      const className = `dw-a dw-a-solved ${solvedIcon} ${unsolveClass}`;
      acceptAnswerButton = r[elemType]({ className,
          onClick: isCoreOrOwnPage ? this.onUnacceptAnswerClick : null, title: solutionTooltip },
        t.Solution);
    }

    const replyingToClass = store_isReplyingTo(store, post)  ? ' s_PA_B-Active' : '';
    const disabledClass = isEditorOpenAlready ? ' s_PA_B-Disabled' : '';

    const replyButton = !store_mayIReply(store, post) ? null :  // or  <span .e_MayNotRe> ?
          r.a({ className: 'dw-a dw-a-reply ' + makeReplyBtnIcon(store)
                + disabledClass + replyingToClass,
              // Highlight the post this Reply button replies to.
              onMouseEnter: isEditorOpenAlready ? undefined :
                  () => ReactActions.highlightPost(post.nr, true),
              // Remove any highlight also if editor open, so disappears after
              // click —> eitor-opens —> mouseleave.
              onMouseLeave: () => ReactActions.highlightPost(post.nr, false),
              onClick: isEditorOpenAlready ? undefined : this.onReplyClick },
            makeReplyBtnTitle(store, post));

    const changeButton = !isCoreOrOwnPage || !isPageBody || isEditingThisPost ? null :
          r.a({ className: 'dw-a dw-a-change',
              onClick: event => {
                const rect = cloneEventTargetRect(event);
                morebundle.openChangePageDialog(rect, { page })
              }},
            t.ChangeV + ' ...');

    // Votes can be disabled for blog posts only, right now, [POSTSORDR]
    // except for the Disagree vote which can be disabled everywhere.
    const isEmbOrigPost = isEmbeddedComments && isPageBody;
    const useDownvotes = !isEmbOrigPost || page.origPostVotes === OrigPostVotes.AllVotes;
    const useLikeVote  = !isEmbOrigPost || page.origPostVotes !== OrigPostVotes.NoVotes;
    const isDisagreeEnabled = page_voteTypeEnabled(page, post, PostVoteType.Disagree);

    // If isn't staff, then the only "downvote" is the Disagree vote.
    const canDownvote = useDownvotes && (isDisagreeEnabled || isStaff(me));

    let numLikesText: RElm | U;
    if (post.numLikeVotes && useLikeVote) {
      numLikesText = r.a({ className: 'dw-a dw-vote-count e_VoLi',
            onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Like, event.target) },
          t.pa.NumLikes(post.numLikeVotes));
    }

    let numWrongsText: RElm | U;
    if (post.numWrongVotes && useDownvotes && isDisagreeEnabled) {
      numWrongsText = r.a({ className: 'dw-a dw-vote-count e_VoWr',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Disagree, event.target) },
          t.pa.NumDisagree(post.numWrongVotes));
    }

    // Bury votes aren't downvotes or bad in any way, so don't show them, except for
    // staff, so they can detect misuse.
    // UX: one won't see one's own Bury vote (unless one is staff). That's confusing. What do about that?
    let numBurysText: RElm | U;
    if (isStaff(me) && post.numBuryVotes && useDownvotes) {
      numBurysText = r.a({ className: 'dw-a dw-vote-count e_VoBu',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Bury, event.target) },
          t.pa.NumBury(post.numBuryVotes));
    }

    let numUnwantedsText: RElm | U;
    if (post.numUnwantedVotes && useDownvotes) {
      numUnwantedsText = r.a({ className: 'dw-a dw-vote-count e_VoUn',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Unwanted, event.target) },
          t.pa.NumUnwanted(post.numUnwantedVotes));
    }

    let downvotesDropdown: RElm | U;
    let likeVoteButton: RElm | U;
    if (!deletedOrCollapsed && post.isApproved && !isOwnPost &&
        // Don't allow voting whilst editing — that currently would replace the
        // edit preview post [EDPVWPST] with the real post.
        !isEditingThisPost) {
      const myLikeVote = votes_includes(myVotes, PostVoteType.Like) ? ' dw-my-vote' : '';
      const myWrongVote = isDisagreeEnabled && votes_includes(myVotes, PostVoteType.Disagree) ?
              ' dw-my-vote' : '';
      const myBuryVote = votes_includes(myVotes, PostVoteType.Bury) ? ' dw-my-vote' : '';
      const myUnwantedVote = votes_includes(myVotes, PostVoteType.Unwanted) ? ' dw-my-vote' : '';
      const myOtherVotes = myWrongVote || myBuryVote || myUnwantedVote ? ' dw-my-vote' : '';

      // Always hide the downvotes inside this dropdown, so one has to click one
      // extra time (to open the dropdown), before one can downvote.
      // For now, skip downvotes for the Orig Post. Don't remember why I
      // disabled that originally — doesn't look so aesthetically nice at least,
      // without some CSS tweaks.
      // Enable when fixing [DBLINHERIT]?  [OPDOWNV]
      downvotesDropdown = isPageBody || !canDownvote ? null :
          r.span({ className: 'dropdown navbar-right', title: t.pa.MoreVotes,
              onClick: this.openMoreVotesDropdown },
            r.a({ className: 'dw-a dw-a-votes' + myOtherVotes }, ''));

      likeVoteButton = !useLikeVote ? null :
          r.a({ className: 'dw-a dw-a-like icon-heart' + myLikeVote,
            title: t.pa.LikeThis, onClick: this.onLikeClick });
    }


    // Dupl code [305RKTDJ2]
    const anyEditsDraft = _.find(myPageData.myDrafts, (d: Draft) => {
      return d.forWhat.postId === post.uniqueId && 
          d.forWhat.draftType === DraftType.Edit;
    });
    const unfinEditsClass = anyEditsDraft ? ' s_UnfinEd' : '';

    const wikiSpace = post_isWiki(post) ? "Wiki " : ''; // I18N
    const wikiClass = post_isWiki(post) ? ' s_PA-EdWik' : ''; // [hydrate_probl]

    const mayEdit = store_mayIEditPost(store, post);
    const editButton = !mayEdit || isEditorOpenAlready ? null :
        r.a({ className: 'dw-a dw-a-edit icon-edit' + unfinEditsClass + wikiClass,
              title: t.EditV, onClick: this.onEditClick },
          wikiSpace + (
              anyEditsDraft ? t.d.UnfinEdits : ''));  // [UFINEDT]

    const link =
        r.a({ className: 'dw-a dw-a-link icon-link', title: t.pa.LinkToPost,
              onClick: this.onLinkClick });

    // Build a More... dropdown, but if it would have only one single menu item, inline
    // that menu item instead. — This stuff makes no sense for an embedded discussion orig-post
    // and gets hidden by CSS [5UKWBP2] (but not here because then React messes up the markup
    // when merging server and client side markup).
    let flagBtn;
    let moreDropdown;
    if (isEditingThisPost) {
      // Skip the Flag and More buttons — doing such things when the post is being
      // edited, could have weird effects?  E.g. More + Delete, or + Move-to-other-page,
      // whilst editing.
      // But what if one clicks Delete on the parent post, and deletes the whole tree?
      // Maybe hide the More buttons for *all* posts?
    }
    else if (me.isLoggedIn) {
      moreDropdown =
        r.span({className: 'dropdown navbar-right', onClick: this.openMoreDropdown},
          r.a({className: 'dw-a dw-a-more icon-menu', title: t.MoreDots}));
    }
    else if (!isOwnPost && !deletedOrCollapsed) {
      flagBtn =
        r.a({ className: 'dw-a dw-a-flag icon-flag',
            onClick: (event) => flagPost(post, cloneEventTargetRect(event)),
          title: t.pa.ReportThisPost });
    }

    const adminLink = !me.isAdmin || !isEmbeddedOrigPost ? null : rFragment({},
      r.a({ className: 'dw-a dw-a-other-topics icon-link-ext', href: linkToEmbeddedDiscussions(),
        target: '_blank' }, t.pa.DiscIx),
      r.a({ className: 'dw-a dw-a-admin icon-link-ext', href: linkToReviewPage(),
        target: '_blank' }, t.pa.Admin));

    // BUG? approveOrDeleteBtns won't appear for embedded comments?
    // Instead of this test, should be a post.approvedStatus field. [ApprovedStatus]
    // And `post.isApproved` below will then be: `post.approvedStatus === PendingApproval`.
    const isOrigPostAndPageDeleted = post.nr === BodyNr && isThisPageDeleted;
    // BUG  if deleting page —> mod task completed, then undeleting —>   [undel_posts]
    //   now  post.isApproved is false (was rejected),  mod task done,
    //   but mod buttons still visible :-(
    let approveOrDeleteBtns;  // [in_pg_apr]
    if (!deletedOrCollapsed && !post.isApproved && isStaff(me)
          && !isOrigPostAndPageDeleted) {
      const ModBtn = (decision: ReviewDecision, title: St, clazz: St) => {
        return Button({ className: 's_PA_ModB ' + clazz, onClick: () => {
          morebundle.openDefaultStupidDialog({
            body: title + '?',
            primaryButtonTitle: t.YesDoThat,
            secondaryButonTitle: t.Cancel,
            small: true,
            onPrimaryClick: () => {
              // COULD create a ReactActions fn instead that does this:
              Server.moderatePostOnPage(post, decision, (storePatch: StorePatch) => {
                ReactActions.patchTheStore(storePatch, () => {
                  scrollAndFlashPostNr(post.nr);
                });
              });
            },
          });
        } }, title);
      }
      const spacePage = post.nr === BodyNr ? " page" : '';
      approveOrDeleteBtns =
          rFragment({},
            // English is fine — this is for staff. 0I18N.
            ModBtn(ReviewDecision.Accept,
                  "Approve" + spacePage, 's_PA_ModB-Apr'),
            ModBtn(ReviewDecision.DeletePostOrPage,
                  // (Need not repeate the word "page" here.)
                  "Reject and delete", 's_PA_ModB-Rej'));
    }

    return (
      r.div({ className: 'dw-p-as dw-as esPA', onClick: this.props.onClick },
        replyButton,
        changeButton,
        adminLink,
        flagBtn,
        moreDropdown,
        link,
        editButton,
        downvotesDropdown,
        likeVoteButton,
        numBurysText,
        numWrongsText,
        numLikesText,
        numUnwantedsText,
        acceptAnswerButton,
        approveOrDeleteBtns));
  }
});


// some dupl code [6KUW24]
const MoreVotesDropdownModal = createComponent({
  displayName: 'MoreVotesDropdownModal',

  mixins: [StoreListenerMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData() });
  },

  openForAt: function(post: Post, at) {
    const rect = cloneRect(at.getBoundingClientRect());
    rect.left -= 140; // then modal position looks better
    rect.right += 100;
    this.setState({
      isOpen: true,
      post: post,
      windowWidth: window.innerWidth,
      buttonRect: rect,
    });
  },

  closeSoon: function() {
    setTimeout(this.close, 330);
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  hasVoted: function(what): boolean {
    const store: Store = this.state.store;
    return me_hasVoted(store.me, this.state.post.nr, what);
  },

  onWrongClick: function(event: MouseEvent) {
    const atRect = cloneEventTargetRect(event);
    const post: Post = this.state.post;
    login.loginIfNeededReturnToPost(LoginReason.LoginToDisagree, post.nr, () => {
      toggleVote(this.state.store, post, PostVoteType.Disagree, !this.hasVoted(PostVoteType.Disagree),
            atRect, this.closeSoon);
    });
  },
  onBuryClick: function(event: MouseEvent) {
    const atRect = cloneEventTargetRect(event);
    const post: Post = this.state.post;
    // Not visible unless logged in.
    // [anon_mods]
    toggleVote(this.state.store, post, PostVoteType.Bury, !this.hasVoted(PostVoteType.Bury),
            atRect, this.closeSoon);
  },
  onUnwantedClick: function(event: MouseEvent) {
    const atRect = cloneEventTargetRect(event);
    const post: Post = this.state.post;
    // Not visible unless logged in.
    // [anon_mods]
    toggleVote(this.state.store, post, PostVoteType.Unwanted, !this.hasVoted(PostVoteType.Unwanted),
            atRect, this.closeSoon);
  },

  makeVoteButtons: function() {
    const store = this.state.store;
    const isFlat = store.isFlat; // hmm shouldn't place in the store object, oh well
    const me: Myself = store.me;
    const myPageData: MyPageData = me.myCurrentPageData;
    const post: Post = this.state.post;
    const votes = myPageData.votesByPostNr[post.nr] || [];
    const isOwnPage = store_thisIsMyPage(store);
    const isStaffFullMemberOrOwnPage: boolean =
      isStaff(me) || me.trustLevel >= TrustLevel.FullMember || isOwnPage;
    const isStaffOrCoreMember: boolean =
        isStaff(me) || me.trustLevel >= TrustLevel.CoreMember;

    const isDisagreeEnabled = page_voteTypeEnabled(
            store.currentPage, post, PostVoteType.Disagree);

    const myWrongVote = votes_includes(votes, PostVoteType.Disagree) ? ' dw-my-vote' : '';
    const myBuryVote = votes_includes(votes, PostVoteType.Bury) ? ' dw-my-vote' : '';
    const myUnwantedVote = votes_includes(votes, PostVoteType.Unwanted) ? ' dw-my-vote' : '';

    const wrongVoteButton = !isDisagreeEnabled ? null :
      ExplainingListItem({
        title: r.span({ className: 'dw-a-wrong icon-warning' + myWrongVote }, t.pa.Disagree),
        text: r.span({}, t.pa.DisagreeExpl),
        onClick: this.onWrongClick, key: 'w' });

    // Skip if flat, because then cannot change sort order or collapse, so Bury would be pointless.
    // Also, should be full member, otherwise probably doesn't know what Bury is?
    const buryVoteButton = isFlat || !isStaffFullMemberOrOwnPage ? null :  // [7UKDR10]
      ExplainingListItem({
        title: r.span({ className: 'dw-a-bury icon-bury' + myBuryVote }, t.pa.Bury),
        text: r.span({}, t.pa.BuryExpl),
            // "If the post is correct, but not interesting to read."
        onClick: this.onBuryClick, key: 'b' });

    const unwantedVoteButton = !isStaffOrCoreMember ? null :  // [4DKWV9J2]
      ExplainingListItem({
        title: r.span({ className: 'dw-a-unwanted icon-cancel' + myUnwantedVote }, t.pa.Unwanted),
        text: t.pa.UnwantedExpl,
        onClick: this.onUnwantedClick, key: 'u' });

    return [wrongVoteButton, buryVoteButton, unwantedVoteButton];
  },

  render: function() {
    const state = this.state;
    const content = state.isOpen ? this.makeVoteButtons() : null;
    return (
      DropdownModal({ show: state.isOpen, onHide: this.close,
          atRect: state.buttonRect, windowWidth: state.windowWidth,
          className: 'esDwnvts', showCloseButton: true }, content));
  }
});


function toggleVote(store: Store, post: Post, voteType: PostVoteType, toggleOn: Bo, atRect: Rect,
        closeSoon?: () => V) {
  const page: Page = store.currentPage;
  let action: 'DeleteVote' | 'CreateVote';
  let postNrsRead: PostNr[];
  if (!toggleOn) {
    action = 'DeleteVote';
  }
  else {
    action = 'CreateVote';
    postNrsRead = findPostNrsRead(page.postsByNr, post);
  }

  const data: SaveVotePs = {
    pageId: store.currentPageId,
    postNr: post.nr,
    vote: voteType,
    action,
    postNrsRead,
  };

  if (toggleOn) {
    morebundle.choosePosterPersona({ me: store.me, origins: store,
            discStore: store, postNr: post.nr, atRect,
            }, (doAsOpts: DoAsAndOpts | 'CANCEL') => {
      if (closeSoon) closeSoon();
      if (doAsOpts === 'CANCEL')
        return;
      data.doAsAnon = doAsOpts.doAsAnon;
      save();
    });
  }
  else {
    // The server will delete the vote, no matter which one of pat's aliases (if any) voted.
    // Later: Incl the id of the alias who voted, if one can create be > 1 anonym/alias
    // per page. [one_anon_per_page].
    if (closeSoon) closeSoon();
    save();
  }

  function save() {
    debiki2.Server.saveVote(data, function(storePatch: StorePatch) {
      const by = storePatch.yourAnon || me_toBriefUser(store.me);
      ReactActions.vote(storePatch, action, voteType, post.nr, by);
    });
  }
}


function findPostNrsRead(postsByNr: { [postNr: number]: Post }, post: Post): PostNr[] {
  const postsReadNrs = {};
  postsReadNrs[post.nr] = post.nr;
  let curPostNr = post.nr;
  let nextParentNr = post.parentNr;
  while (!postsReadNrs[nextParentNr]) {
    const parent: Post = postsByNr[nextParentNr];
    if (!parent) {
      // No more parents. Done.
      break;
    }
    if (parent.nr < MinRealPostNr) {
      // The parent isn't a real post — it's a new post draft or preview. But
      // that's impossible? Because its descendant, `post`, is real.
      // @ifdef DEBUG
      die('TyE4064QKTSUTD2');
      // @endif
      break;
    }

    const parentShown = $byId('post-' + parent.nr);
    if (parentShown) {
      postsReadNrs[parent.nr] = parent.nr;
    }

    // Also add all previous siblings visible above curPostNr — because to find and read
    // curPostNr, one needs to scroll past, and probably read, those too.
    for (let i = 0; i < parent.childNrsSorted.length; ++i) {
      const siblingNr = parent.childNrsSorted[i];
      if (siblingNr === curPostNr) {
        // Likely, any siblings sorted *after* curPostNr haven't yet been read,
        // so don't include those.
        // @ifdef DEBUG
        dieIf(!postsReadNrs[siblingNr], 'EdE4GUWKR0');
        // @endif
        break;
      }
      if (siblingNr < MinRealPostNr) {
        // It's a draft or preview — doesn't yet exist for real.
        continue;
      }
      const sibling = postsByNr[siblingNr];
      if (!sibling) {
        // Maybe it and some other siblings got squashed [SQUASHSIBL] and weren't
        // loaded from the server.
        continue;
      }
      const siblingShown = $byId('post-' + siblingNr);
      if (siblingShown) {
        postsReadNrs[siblingNr] = siblingNr;
      }
    }
    curPostNr = parent.nr;
    nextParentNr = parent.parentNr;
  }

  return _.values(postsReadNrs);
}


// some dupl code [6KUW24]
const MoreDropdownModal = createComponent({
  displayName: 'MoreDropdownModal',

  getInitialState: function () {
    return {
      isOpen: false,
    };
  },

  // dupl code [6KUW24]
  openForAt: function(store, post, at) {
    this.setState({
      isOpen: true,
      store: store,
      post: post,
      windowWidth: window.innerWidth,
      buttonRect: cloneRect(at.getBoundingClientRect()),
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onFlagClick: function(event) {
    flagPost(this.state.post, this.state.buttonRect);
    this.close();
  },

  openTagsDialog: function() {
    const state = this.state;
    morebundle.openTagsDialog({ forPost: state.post, store: state.store });
    this.close();
  },

  onDeleteClick: function(event: MouseEvent) {
    const atRect: Rect = cloneEventTargetRect(event);
    const state = this.state;
    const post: Post = state.post;
    morebundle.chooseEditorPersona({ store: state.store, postNr: post.nr, atRect,
            isInstantAction: true }, (doAsOpts: DoAsAndOpts) => {
      morebundle.openDeletePostDialog({ post: this.state.post,
            at: atRect, doAsAnon: doAsOpts.doAsAnon });
    });
    this.close();
  },

  onWikifyClick: function(event) {
    morebundle.openWikifyDialog(this.state.post);
    this.close();
  },

  /*
  onCollapsePostClick: function(event) {
    debiki.internal.$showActionDialog('CollapsePost').call(event.target, event);
    this.close();
  },
  onCollapseTreeClick: function(event) {
    debiki.internal.$showActionDialog('CollapseTree').call(event.target, event);
    this.close();
  },
  onCloseTreeClick: function(event) {
    debiki.internal.$showActionDialog('CloseTree').call(event.target, event);
    this.close();
  },
  onPinClick: function(event) {
    debiki.internal.$showActionDialog('PinTree').call(event.target, event);
    this.close();
  }, */
  onMoveClick: function(event) {
    morebundle.openMovePostsDialog(this.state.store, this.state.post, this.close, this.state.buttonRect);
    this.close();
  },
  onSeeWrenchClick: function(event) {
    debiki2.pagedialogs.openSeeWrenchDialog();
    this.close();
  },

  toggleBranchSideways: function(event) {
    const post: Post = this.state.post;
    Server.editPostSettings(post.uniqueId, {
      branchSideways: post.branchSideways ? 0 : 100,
    });
    this.close();
  },

  makeButtons: function() {
    const store: Store = this.state.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const page: Page = store.currentPage;
    const isFlat = store['isFlat']; // hmm shouldn't place in the store object, oh well
    const me: Myself = store.me;
    const post: Post = this.state.post;
    const isForumSite = settings.enableForum !== false;
    const isPageBody = post.nr === BodyNr;
    const isPostDeleted = post_isDeleted(post);
    const isPageDeleted = page.pageDeletedAtMs;

    const moreLinks = [];
    const isOwnPost = pat_isAuthorOf(me, post, store.usersByIdBrief);
    const isMindMap = page.pageRole === PageRole.MindMap;

    // ----- Report

    if (!isPostDeleted) moreLinks.push(
      r.a({ className: 'dw-a dw-a-flag icon-flag', onClick: this.onFlagClick, key: 'rp' },
        t.pa.Report));

    // ----- Pin post

    /* Doesn't work right now, after Post2 rewrite
     if (user.isAdmin && !isPageBody)
     moreLinks.push(
     r.a({ className: 'dw-a dw-a-pin icon-pin', onClick: this.onPinClick, key: 'pn' }, 'Pin'));
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

    // ----- Tags

    if (pat_mayEditTags(me, { forPost: post, store })) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-plus', onClick: this.openTagsDialog, key: 'ts' },
          t.pa.AddTags));
    }

    // ----- Delete

    if (!isPageBody && (isStaff(me) || isOwnPost) && !isPostDeleted) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-delete icon-trash', onClick: this.onDeleteClick, key: 'dl' },
          t.Delete));
    }

    // ----- Unelete

    // Later, [UNDELPOST]

    // ----- Post settings

    // UX BUG: Wikified posts no longer looks good, because of the avatar icon to the left.
    // Only the orig post looks ok.
    if ((isStaff(me) || isOwnPost) && !isFlat && isForumSite && !isPostDeleted) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-users s_PA_WkB', onClick: this.onWikifyClick, key: 'wf' },
          isWikiPost(post) ? t.pa.UnWikify : t.pa.Wikify));
    }

    // ----- Move post

    // UX BUG Currently doesn't work in iframes — because the copy-link dialog copies addresses  [6JKD2A]
    // with the embedding site's origin, and when pasting the link, that'll be the wrong origin.
    if (!isPageBody && isStaff(me) && !store.isEmbedded && !isPostDeleted) {
      moreLinks.push(
        r.a({ className: 'dw-a s_PA_MvB icon-paper-plane-empty', onClick: this.onMoveClick, key: 'mp' },
          t.Move));
    }

    // ----- Look elsewhere button

    // Pin/delete/etc is placed in the topbar, not here, so that it'll be available also
    // once one has scrolled down past the orig post.
    if (isPageBody && isStaff(me)) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-help-circled', onClick: this.onSeeWrenchClick, key: 'sw' },
          t.pa.PinDeleteEtc));
    }

    // ----- Mind map branch sideways

    /* Mind mapst disabled [2D_LAYOUT]
    if (!isPageBody && isMindMap && (isStaff(me) || isOwnPost)) {   && !isPostDeleted
      let sidewaysTitle = post.branchSideways ? "Don't branch sideways" : "→ Branch sideways";
      moreLinks.push(
        r.a({ className: 'dw-a', onClick: this.toggleBranchSideways, key: 'bs' },
          sidewaysTitle));
    } */

    return moreLinks;
  },

  render: function() {
    const state = this.state;
    const content = state.isOpen ? this.makeButtons() : null;
    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, showCloseButton: true,
          className: 'e_PAMoreD', atRect: state.buttonRect, windowWidth: state.windowWidth },
        content));
  }
});


function flagPost(post: Post, at: Rect) {
  login.loginIfNeededReturnToPost(LoginReason.LoginToFlag, post.nr, () => {
    morebundle.openFlagDialog(post.nr, at);
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
