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
    const post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    if (!me.isAdmin)
      return null;

    // Dupl code [305RKTDJ2]
    const myPageData: MyPageData = me.myCurrentPageData;
    const anyEditsDraft = _.find(myPageData.myDrafts, (d: Draft) => {
      return d.forWhat.postId === post.uniqueId && 
          d.forWhat.draftType === DraftType.Edit;
    });
    const unfinEditsClass = anyEditsDraft ? ' s_UnfinEd' : '';

    const editBtn = store.isEditorOpen ? null :
        r.a({ className: 'dw-a dw-a-edit icon-edit' + unfinEditsClass, onClick: this.onEditClick },
          t.EditV + (
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

  onAcceptAnswerClick: function() {
    ReactActions.acceptAnswer(this.props.post.uniqueId);
  },
  onUnacceptAnswerClick: function() {
    ReactActions.unacceptAnswer();
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
        LoginReason.PostEmbeddedComment : 'LoginToComment';

    login.loginIfNeededReturnToPost(loginToWhat, post.nr, () => {
      if (this.isGone) return;
      ReactActions.composeReplyTo(post.nr, newPostType);
    }, true);
  },

  onEditClick: function(event) {
    ReactActions.editPostWithNr(this.props.post.nr);
  },
  onLinkClick: function(event) {
    morebundle.openShareDialog(this.props.post, event.target);
  },
  onLikeClick: function(event) {
    const store: Store = this.props.store;
    const post: Post = this.props.post;
    loginIfNeededThen(LoginReason.LoginToLike, post.nr, () => {
      if (this.isGone) return;
      const toggleOn = !me_hasVoted(store.me, post.nr, 'VoteLike');
      toggleVote(this.props.store, post, 'VoteLike', toggleOn);
    });
  },

  openMoreVotesDropdown: function(event) {
    openMoreVotesDropdown(this.props.post, event.target);
  },

  openMoreDropdown: function(event) {
    openMoreDropdown(this.props.store, this.props.post, event.target);
  },

  render: function() {
    const post: Post = this.props.post;
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    const isQuestion = page.pageRole === PageRole.Question;
    // (Some dupl code, see Title above and isDone() and isAnswered() in forum.ts [4KEPW2]
    const isAnswered = isQuestion && page.pageAnsweredAtMs;
    const isDone = page.pageDoneAtMs && (page.pageRole === PageRole.Problem ||
      page.pageRole === PageRole.Idea || page.pageRole === PageRole.ToDo ||
      page.pageRole === PageRole.UsabilityTesting);  // [plugin]
    const isEmbeddedComments = page.pageRole === PageRole.EmbeddedComments;

    const me: Myself = store.me;
    const myPageData: MyPageData = me.myCurrentPageData;
    const isOwnPost = me.id === post.authorId;
    const isOwnPage = store_thisIsMyPage(store);
    const isPageBody = post.nr === BodyNr;
    const votes = myPageData.votes[post.nr] || [];
    const isStaffOrOwnPage: boolean = isStaff(me) || isOwnPage;
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
    else if (isStaffOrOwnPage && isQuestion && !page.pageAnsweredAtMs && !page.pageClosedAtMs &&
        !isPageBody && post.isApproved) {
      acceptAnswerButton = r.a({ className: 'dw-a dw-a-solve icon-ok-circled-empty',
          onClick: this.onAcceptAnswerClick, title: t.pa.AcceptBtnExpl }, t.pa.SolutionQ);
    }
    else if (isQuestion && post.uniqueId === page.pageAnswerPostUniqueId) {
      // (Do this even if !post.isApproved.)
      const solutionTooltip = isStaffOrOwnPage
          ? t.pa.ClickUnaccept
          : t.pa.PostAccepted;
      const elemType = isStaffOrOwnPage ? 'a' : 'span';
      const unsolveClass = isStaffOrOwnPage ? ' dw-a-unsolve' : '';
      acceptAnswerButton = r[elemType]({ className: 'dw-a dw-a-solved icon-ok-circled' + unsolveClass,
          onClick: isStaffOrOwnPage ? this.onUnacceptAnswerClick : null, title: solutionTooltip },
        t.Solution);
    }

    const replyingToClass = store.replyingToPostNr === post.nr  ? ' s_PA_B-Active' : '';
    const disabledClass = isEditorOpenAlready ? ' s_PA_B-Disabled' : '';

    const replyButton = !store_mayIReply(store, post) ? null :
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

    const changeButton = !isStaffOrOwnPage || !isPageBody || isEditingThisPost ? null :
          r.a({ className: 'dw-a dw-a-change',
              onClick: event => {
                const rect = cloneEventTargetRect(event);
                morebundle.openChangePageDialog(rect, { page })
              }},
            t.ChangeV + ' ...');

    // Votes can be disabled for blog posts only, right now: [POSTSORDR]
    const isEmbOrigPost = isEmbeddedComments && isPageBody;
    const useDownvotes = !isEmbOrigPost || page.origPostVotes === OrigPostVotes.AllVotes;
    const useLikeVote  = !isEmbOrigPost || page.origPostVotes !== OrigPostVotes.NoVotes;

    let numLikesText;
    if (post.numLikeVotes && useLikeVote) {
      numLikesText = r.a({ className: 'dw-a dw-vote-count',
            onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Like, event.target) },
          t.pa.NumLikes(post.numLikeVotes));
    }

    let numWrongsText;
    if (post.numWrongVotes && useDownvotes) {
      numWrongsText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Disagree, event.target) },
          t.pa.NumDisagree(post.numWrongVotes));
    }

    // Bury votes aren't downvotes or bad in any way, so don't show them, except for
    // staff, so they can detect misuse.
    // UX: one won't see one's own Bury vote (unless one is staff). That's confusing. What do about that?
    let numBurysText;
    if (isStaff(me) && post.numBuryVotes && useDownvotes) {
      numBurysText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Bury, event.target) },
          t.pa.NumBury(post.numBuryVotes));
    }

    let numUnwantedsText;
    if (post.numUnwantedVotes && useDownvotes) {
      numUnwantedsText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Unwanted, event.target) },
          t.pa.NumUnwanted(post.numUnwantedVotes));
    }

    let downvotesDropdown;
    let likeVoteButton;
    if (!deletedOrCollapsed && post.isApproved && !isOwnPost &&
        // Don't allow voting whilst editing — that currently would replace the
        // edit preview post [EDPVWPST] with the real post.
        !isEditingThisPost) {
      const myLikeVote = votes.indexOf('VoteLike') !== -1 ? ' dw-my-vote' : '';
      const myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : '';
      const myBuryVote = votes.indexOf('VoteBury') !== -1 ? ' dw-my-vote' : '';
      const myUnwantedVote = votes.indexOf('VoteUnwanted') !== -1 ? ' dw-my-vote' : '';
      const myOtherVotes = myWrongVote || myBuryVote || myUnwantedVote ? ' dw-my-vote' : '';

      // Always hide the downvotes inside this dropdown, so one has to click one
      // extra time (to open the dropdown), before one can downvote.
      // For now, skip downvotes for the Orig Post. Don't remember why I
      // disabled that originally — doesn't look so aesthetically nice at least,
      // without some CSS tweaks.
      // Enable when fixing [DBLINHERIT]?  [OPDOWNV]
      downvotesDropdown = isPageBody || !useDownvotes ? null :
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

    const mayEdit = store_mayIEditPost(store, post);
    const editButton = !mayEdit || isEditorOpenAlready ? null :
        r.a({ className: 'dw-a dw-a-edit icon-edit' + unfinEditsClass, title: t.EditV,
              onClick: this.onEditClick },
          anyEditsDraft ? t.d.UnfinEdits : null);  // [UFINEDT]

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

    let tagList;
    if (post.tags && post.tags.length) {
      const tags = post.tags.map((label) => {
        return r.li({ key: label }, r.a({ className: 'esTg' }, label));
      });
      tagList = r.ul({ className: 'esPA_Ts' }, tags);
    }

    const adminLink = !me.isAdmin || !isEmbeddedOrigPost ? null : rFragment({},
      r.a({ className: 'dw-a dw-a-other-topics icon-link-ext', href: linkToEmbeddedDiscussions(),
        target: '_blank' }, t.pa.DiscIx),
      r.a({ className: 'dw-a dw-a-admin icon-link-ext', href: linkToReviewPage(),
        target: '_blank' }, t.pa.Admin));

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
        tagList));
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

  onWrongClick: function(event) {
    const post: Post = this.state.post;
    loginIfNeededThen('LoginToVote', post.nr, () => {
      toggleVote(this.state.store, post, 'VoteWrong', !this.hasVoted('VoteWrong'));
      this.closeSoon();
    });
  },
  onBuryClick: function(event) {
    const post: Post = this.state.post;
    loginIfNeededThen('LoginToVote', post.nr, () => {
      toggleVote(this.state.store, post, 'VoteBury', !this.hasVoted('VoteBury'));
      this.closeSoon();
    });
  },
  onUnwantedClick: function(event) {
    const post: Post = this.state.post;
    loginIfNeededThen('LoginToVote', post.nr, () => {
      toggleVote(this.state.store, post, 'VoteUnwanted', !this.hasVoted('VoteUnwanted'));
      this.closeSoon();
    });
  },

  makeVoteButtons: function() {
    const store = this.state.store;
    const isFlat = store.isFlat; // hmm shouldn't place in the store object, oh well
    const me: Myself = store.me;
    const myPageData: MyPageData = me.myCurrentPageData;
    const post: Post = this.state.post;
    const votes = myPageData.votes[post.nr] || [];
    const isOwnPage = store_thisIsMyPage(store);
    const isStaffFullMemberOrOwnPage: boolean =
      isStaff(me) || me.trustLevel >= TrustLevel.FullMember || isOwnPage;
    const isStaffOrCoreMember: boolean =
        isStaff(me) || me.trustLevel >= TrustLevel.CoreMember;

    const myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : '';
    const myBuryVote = votes.indexOf('VoteBury') !== -1 ? ' dw-my-vote' : '';
    const myUnwantedVote = votes.indexOf('VoteUnwanted') !== -1 ? ' dw-my-vote' : '';

    const wrongVoteButton =
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


// CLEAN_UP use enum PostVoteType for voteType, instead of string.
function toggleVote(store: Store, post: Post, voteType: string, toggleOn: boolean) {
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

  const data = {
    pageId: store.currentPageId,
    postNr: post.nr,
    vote: voteType,
    action: action,
    postNrsRead: postNrsRead
  };

  debiki2.Server.saveVote(data, function(updatedPost) {
    ReactActions.vote(updatedPost, action, voteType);
  });
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

  openTagsDialog: function(event) {
    morebundle.openTagsDialog(this.state.store, this.state.post);
    this.close();
  },

  onDeleteClick: function(event) {
    morebundle.openDeletePostDialog(this.state.post, this.state.buttonRect);
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
    const isOwnPost = post.authorId === me.id;
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

    if ((isStaff(me) || isOwnPost) && !store.isEmbedded && settings.enableTags !== false) {
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

    // Wikified posts no longer looks good, because of the avatar icon to the left.
    // Only the orig post looks ok, therefore: `isPageBody &&`.
    if ((isPageBody || isMindMap) && (isStaff(me) || isOwnPost) && !isFlat && isForumSite) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-users s_PA_WkB', onClick: this.onWikifyClick, key: 'wf' },
          isWikiPost(post) ? t.pa.UnWikify : t.pa.Wikify));
    }

    // ----- Move post

    // UX BUG Currently doesn't work in iframes — because the copy-link dialog copies addresses  [6JKD2A]
    // with the embedding site's origin, and when pasting the link, that'll be the wrong origin.
    if (!isPageBody && isStaff(me) && !store.isEmbedded) {
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

    if (!isPageBody && isMindMap && (isStaff(me) || isOwnPost)) {
      let sidewaysTitle = post.branchSideways ? "Don't branch sideways" : "→ Branch sideways";
      moreLinks.push(
        r.a({ className: 'dw-a', onClick: this.toggleBranchSideways, key: 'bs' },
          sidewaysTitle));
    }

    return moreLinks;
  },

  render: function() {
    const state = this.state;
    const content = state.isOpen ? this.makeButtons() : null;
    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, showCloseButton: true,
          atRect: state.buttonRect, windowWidth: state.windowWidth },
        content));
  }
});


function flagPost(post: Post, at: Rect) {
  loginIfNeededThen('LoginToFlag', post.nr, () => {
    morebundle.openFlagDialog(post.nr, at);
  });
}


function loginIfNeededThen(loginToWhat, postNr: PostNr, success: () => void) {
  login.loginIfNeededReturnToPost(loginToWhat, postNr, success);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
