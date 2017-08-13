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

/// <reference path="../plain-old-javascript.d.ts" />
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

const d = { i: debiki.internal };

var React = window['React']; // TypeScript file doesn't work
var r = React.DOM;
var DropdownModal = utils.DropdownModal;
var ExplainingListItem = util.ExplainingListItem;

var moreVotesDropdownModal;
var moreDialog;


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


export var NoCommentsPageActions = createComponent({
  displayName: 'NoCommentsPageActions',

  onEditClick: function(event) {
    debiki2.ReactActions.editPostWithNr(this.props.post.nr);
  },

  render: function() {
    var me: Myself = this.props.me;
    var post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    if (!me.isAdmin)
      return null;

    var actions =
          r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit');

    return (
      r.div({ className: 'dw-p-as dw-as' }, actions));
  }
});


export function makeReplyBtnIcon(store: Store) {
  return store.pageRole === PageRole.MindMap ? 'icon-plus' : 'icon-reply';
}


export function makeReplyBtnTitle(store: Store, post: Post, isAppendReplyButton: boolean) {
  if (post.nr !== BodyNr) {
    if (store.pageRole === PageRole.MindMap)
      return "Add node";
    else
      return "Reply";
  }

  switch (store.pageRole) {
    case PageRole.Critique: return "Give Critique"; // [plugin]
    case PageRole.UsabilityTesting: return "Give Feedback"; // [plugin]
    case PageRole.MindMap: return "Add Mind Map node";
    default:
      return isAppendReplyButton ? "Reply to the Original Post" : "Reply";
  }
}


export const PostActions = createComponent({
  displayName: 'PostActions',

  onAcceptAnswerClick: function() {
    debiki2.ReactActions.acceptAnswer(this.props.post.uniqueId);
  },
  onUnacceptAnswerClick: function() {
    debiki2.ReactActions.unacceptAnswer();
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onReplyClick: function(event) {
    // Some dupl code [69KFUW20]
    event.preventDefault();
    const eventTarget = event.target; // React.js will clear the field
    // (Don't check this.props...isFlat here — use postType instead.)
    const post: Post = this.props.post;
    const newPostType = post.postType === PostType.Flat ? PostType.Flat : PostType.Normal;
    login.loginIfNeededReturnToPost('LoginToComment', post.nr, function() {
      if (this.isGone) return;
      // Toggle highlighting first, because it'll be cleared later if the
      // editor is closed, and then we don't want to toggle it afterwards.
      $h.toggleClass(eventTarget, 'dw-replying');
      if (debiki.internal.isInEmbeddedCommentsIframe) {
        window.parent.postMessage(JSON.stringify(['editorToggleReply', post.nr]), '*');
      }
      else {
        debiki2.editor.toggleWriteReplyToPost(post.nr, newPostType);
      }
    });
  },

  onCloseClick: function() {
    debiki2.ReactActions.togglePageClosed();
  },
  onEditClick: function(event) {
    debiki2.ReactActions.editPostWithNr(this.props.post.nr);
  },
  onLinkClick: function(event) {
    morebundle.openShareDialog(this.props.post, event.target);
  },
  onLikeClick: function(event) {
    loginIfNeededThen(LoginReason.LoginToLike, this.props.post.postNr, () => {
      if (this.isGone) return;
      let post: Post = this.props.post;
      var toggleOn = !me_hasVoted(this.props.store.me, post.nr, 'VoteLike');
      debiki.internal.toggleVote(post.nr, 'VoteLike', toggleOn);
    });
  },

  openMoreVotesDropdown: function(event) {
    openMoreVotesDropdown(this.props.post, event.target);
  },

  openMoreDropdown: function(event) {
    openMoreDropdown(this.props.store, this.props.post, event.target);
  },

  render: function() {
    var post: Post = this.props.post;
    var store: Store = this.props.store;
    var isQuestion = store.pageRole === PageRole.Question;
    var isFlat = this.props.store.isFlat; // hmm isFlat shouldn't be placed in store, oh well
    // (Some dupl code, see Title above and isDone() and isAnswered() in forum.ts [4KEPW2]
    var isAnswered = isQuestion && store.pageAnsweredAtMs;
    var isDone = store.pageDoneAtMs && (store.pageRole === PageRole.Problem ||
      store.pageRole === PageRole.Idea || store.pageRole === PageRole.ToDo ||
      store.pageRole === PageRole.UsabilityTesting);  // [plugin]

    var me: Myself = store.me;
    var isOwnPost = me.id === post.authorId;
    var isOwnPage = store_thisIsMyPage(store);
    var isPageBody = post.nr === BodyNr;
    var votes = me.votes[post.nr] || [];
    var isStaffOrOwnPage: boolean = isStaff(me) || isOwnPage;

    const deletedOrCollapsed = post_isDeletedOrCollapsed(post);

    // For now. Later, add e.g. Undelete or View Deleted actions.
    // (Do return a <div> so there'll be some whitespace below for arrows to any replies.)
    if (deletedOrCollapsed)
      return r.div({ className: 'dw-p-as dw-as' });

    var acceptAnswerButton;
    if (isStaffOrOwnPage && isQuestion && !store.pageAnsweredAtMs && !store.pageClosedAtMs &&
        !isPageBody && post.isApproved) {
      acceptAnswerButton = r.a({ className: 'dw-a dw-a-solve icon-ok-circled-empty',
          onClick: this.onAcceptAnswerClick, title: "Accept this as the answer to the " +
              "question or problem" }, "Solution?");
    }
    else if (isQuestion && post.uniqueId === store.pageAnswerPostUniqueId) {
      // (Do this even if !post.isApproved.)
      var solutionTooltip = isStaffOrOwnPage
          ? "Click to un-accept this answer"
          : "This post has been accepted as the answer";
      var elemType = isStaffOrOwnPage ? 'a' : 'span';
      var unsolveClass = isStaffOrOwnPage ? ' dw-a-unsolve' : '';
      acceptAnswerButton = r[elemType]({ className: 'dw-a dw-a-solved icon-ok-circled' + unsolveClass,
          onClick: isStaffOrOwnPage ? this.onUnacceptAnswerClick : null, title: solutionTooltip },
        "Solution");
    }

    const replyButton = !store_mayIReply(store, post) ? null :
          r.a({ className: 'dw-a dw-a-reply ' + makeReplyBtnIcon(store),
              onClick: this.onReplyClick },
            makeReplyBtnTitle(store, post, false));

    // Show a close button for unanswered questions and pending to-dos, and a reopen
    // button if the topic has been closed unanswered / unfixed. (But if it's been
    // answered/fixed, the way to reopen it is to click the answered/fixed icon, to
    // mark it as not-answered/not-fixed again.)
    var closeReopenButton;
    var canCloseOrReopen = !isDone && !isAnswered && page_canBeClosed(store.pageRole);
    if (isPageBody && canCloseOrReopen && isStaffOrOwnPage) {
      var closeReopenTitle = "Reopen";
      var closeReopenIcon = 'icon-circle-empty';
      var closeReopenTooltip;
      if (!store.pageClosedAtMs) {
        closeReopenTitle = "Close";
        closeReopenIcon = 'icon-block';
        switch (store.pageRole) {
          case PageRole.Question:
            if (isOwnPage)
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

    let numLikesText;
    if (post.numLikeVotes) {
      numLikesText = r.a({ className: 'dw-a dw-vote-count',
            onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Like, event.target) },
          post.numLikeVotes === 1 ? "1 Like" : post.numLikeVotes + " Likes");
    }

    let numWrongsText;
    if (post.numWrongVotes) {
      numWrongsText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Disagree, event.target) },
          post.numWrongVotes + " Disagree");
          //post.numWrongVotes === 1 ? "1 Wrong" : post.numWrongVotes + " Wrongs");
    }

    // Bury votes aren't downvotes or bad in any way, so don't show them, except for
    // staff, so they can detect misuse.
    let numBurysText;
    if (isStaff(me) && post.numBuryVotes) {
      numBurysText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Bury, event.target) },
          post.numBuryVotes === 1 ? "1 Bury" : post.numBuryVotes + " Burys");
    }

    let numUnwantedsText;
    if (post.numUnwantedVotes) {
      numUnwantedsText = r.a({ className: 'dw-a dw-vote-count',
          onClick: (event) => morebundle.openLikesDialog(post, PostVoteType.Unwanted, event.target) },
          post.numUnwantedVotes === 1 ? "1 Unwanted" : post.numUnwantedVotes + " Unwanteds");
    }

    let downvotesDropdown;
    let likeVoteButton;
    if (!deletedOrCollapsed && post.isApproved && !isOwnPost) {
      const myLikeVote = votes.indexOf('VoteLike') !== -1 ? ' dw-my-vote' : '';
      const myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : '';
      const myBuryVote = votes.indexOf('VoteBury') !== -1 ? ' dw-my-vote' : '';
      const myUnwantedVote = votes.indexOf('VoteUnwanted') !== -1 ? ' dw-my-vote' : '';
      const myOtherVotes = myWrongVote || myBuryVote || myUnwantedVote ? ' dw-my-vote' : '';

      // Always hide the downvotes inside this dropdown, so one has to click one
      // extra time (to open the dropdown), before one can downvote.
      downvotesDropdown = post.nr === BodyNr ? null :
          r.span({ className: 'dropdown navbar-right', title: "More votes...",
              onClick: this.openMoreVotesDropdown },
            r.a({ className: 'dw-a dw-a-votes' + myOtherVotes }, ''));

      likeVoteButton =
          r.a({ className: 'dw-a dw-a-like icon-heart' + myLikeVote,
            title: "Like this", onClick: this.onLikeClick });
    }


    const mayEdit = store_mayIEditPost(store, post);
    const editButton = !mayEdit ? null :
        r.a({ className: 'dw-a dw-a-edit icon-edit', title: "Edit",
              onClick: this.onEditClick });

    const link = deletedOrCollapsed ? null :
        r.a({ className: 'dw-a dw-a-link icon-link', title: "Link to this post",
              onClick: this.onLinkClick });

    // Build a More... dropdown, but if it would have only one single menu item, inline
    // that menu item instead.
    let flagBtn;
    let moreDropdown;
    if (me.isLoggedIn) {
      moreDropdown =
        r.span({className: 'dropdown navbar-right', onClick: this.openMoreDropdown},
          r.a({className: 'dw-a dw-a-more icon-menu', title: "More..."}));
    }
    else if (!isOwnPost) {
      flagBtn =
        r.a({ className: 'dw-a dw-a-flag icon-flag', onClick: () => flagPost(post),
          title: "Report this post" });
    }

    let tagList;
    if (post.tags && post.tags.length) {
      const tags = post.tags.map((label) => {
        return r.li({ key: label }, r.a({ className: 'esTg' }, label));
      });
      tagList = r.ul({ className: 'esPA_Ts' }, tags);
    }

    const adminLink = !me.isAdmin || !d.i.isInEmbeddedCommentsIframe || !isPageBody ? null :
      r.a({ className: 'dw-a dw-a-admin icon-link-ext', href: d.i.serverOrigin + linkToReviewPage(),
        target: '_blank' }, "Admin");

    return (
      r.div({ className: 'dw-p-as dw-as esPA', onClick: this.props.onClick },
        replyButton,
        adminLink,
        closeReopenButton,
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
    var rect = cloneRect(at.getBoundingClientRect());
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
    return me_hasVoted(this.state.store.me, this.state.post.nr, what);
  },

  onWrongClick: function(event) {
    loginIfNeededThen('LoginToVote', this.state.post.postNr, () => {
      debiki.internal.toggleVote(this.state.post.nr, 'VoteWrong', !this.hasVoted('VoteWrong'));
      this.closeSoon();
    });
  },
  onBuryClick: function(event) {
    loginIfNeededThen('LoginToVote', this.state.post.postNr, () => {
      debiki.internal.toggleVote(this.state.post.nr, 'VoteBury', !this.hasVoted('VoteBury'));
      this.closeSoon();
    });
  },
  onUnwantedClick: function(event) {
    loginIfNeededThen('LoginToVote', this.state.post.postNr, () => {
      debiki.internal.toggleVote(this.state.post.nr, 'VoteUnwanted', !this.hasVoted('VoteUnwanted'));
      this.closeSoon();
    });
  },

  makeVoteButtons: function() {
    const store = this.state.store;
    const isFlat = store.isFlat; // hmm shouldn't place in the store object, oh well
    const me: Myself = store.me;
    const post: Post = this.state.post;
    const votes = me.votes[post.nr] || [];
    const isOwnPage = store_thisIsMyPage(store);
    const isStaffFullMemberOrOwnPage: boolean =
      isStaff(me) || me.trustLevel >= TrustLevel.Member || isOwnPage;
    const isStaffOrCoreMember: boolean =
        isStaff(me) || me.trustLevel >= TrustLevel.CoreMember;

    const myWrongVote = votes.indexOf('VoteWrong') !== -1 ? ' dw-my-vote' : '';
    const myBuryVote = votes.indexOf('VoteBury') !== -1 ? ' dw-my-vote' : '';
    const myUnwantedVote = votes.indexOf('VoteUnwanted') !== -1 ? ' dw-my-vote' : '';

    const wrongVoteButton =
      ExplainingListItem({
        title: r.span({ className: 'dw-a-wrong icon-warning' + myWrongVote }, "Disagree"),
        text: r.span({}, "Click here to disagree with this post, " +
            "or to warn others about factual errors."),
        onClick: this.onWrongClick, key: 'w' });

    // Skip if flat, because then cannot change sort order or collapse, so Bury would be pointless.
    // Also, should be full member, otherwise probably doesn't know what Bury is?
    const buryVoteButton = isFlat || !isStaffFullMemberOrOwnPage ? null :  // [7UKDR10]
      ExplainingListItem({
        title: r.span({ className: 'dw-a-bury icon-bury' + myBuryVote }, "Bury"),
        text: r.span({}, "Click to sort other posts before this post. " +
          "Only the forum staff can see your vote."),
            // "If the post is correct, but not interesting to read."
        onClick: this.onBuryClick, key: 'b' });

    const unwantedVoteButton = !isStaffOrCoreMember ? null :  // [4DKWV9J2]
      ExplainingListItem({
        title: r.span({ className: 'dw-a-unwanted icon-cancel' + myUnwantedVote }, "Unwanted"),
        text: "If you do not want this post on this website. This would reduce the trust I have " +
            "in the post author. Only the forum staff can see your vote.",
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


// some dupl code [6KUW24]
var MoreDropdownModal = createComponent({
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
    flagPost(this.state.post);
    this.close();
  },

  openTagsDialog: function(event) {
    morebundle.openTagsDialog(this.state.store, this.state.post);
    this.close();
  },

  onDeleteClick: function(event) {
    morebundle.openDeletePostDialog(this.state.post);
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
    morebundle.openMovePostsDialog(this.state.store, this.state.post, this.close);
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
    const isFlat = store['isFlat']; // hmm shouldn't place in the store object, oh well
    const me: Myself = store.me;
    const post: Post = this.state.post;
    const isPageBody = post.nr === BodyNr;

    const moreLinks = [];
    const isOwnPost = post.authorId === me.id;
    const isMindMap = store.pageRole === PageRole.MindMap;

    // ----- Report

    moreLinks.push(
      r.a({ className: 'dw-a dw-a-flag icon-flag', onClick: this.onFlagClick, key: 'rp' },
        "Report"));

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

    if (isStaff(me) || isOwnPost) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-plus', onClick: this.openTagsDialog, key: 'ts' },
          "Add/remove tags"));
    }

    // ----- Delete

    if (!isPageBody && (isStaff(me) || isOwnPost)) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-delete icon-trash', onClick: this.onDeleteClick, key: 'dl' },
          "Delete"));
    }

    // ----- Post settings

    // Wikified posts no longer looks good, because of the avatar icon to the left.
    // Only the orig post looks ok, therefore: `isPageBody &&`.
    if ((isPageBody || isMindMap) && (isStaff(me) || isOwnPost) && !isFlat) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-users', onClick: this.onWikifyClick, key: 'wf' },
          isWikiPost(post) ? "Un-Wikify" : "Wikify"));
    }

    // ----- Move post

    if (!isPageBody && isStaff(me)) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-paper-plane-empty', onClick: this.onMoveClick, key: 'mp' },
          "Move"));
    }

    // ----- Look elsewhere button

    // Pin/delete/etc is placed in the topbar, not here, so that it'll be available also
    // once one has scrolled down past the orig post.
    if (isPageBody && isStaff(me)) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-help-circled', onClick: this.onSeeWrenchClick, key: 'sw' },
          "Pin / Delete / Category ..."));
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
    var state = this.state;
    var content = state.isOpen ? this.makeButtons() : null;
    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, showCloseButton: true,
          atRect: state.buttonRect, windowWidth: state.windowWidth },
        content));
  }
});


function flagPost(post: Post) {
  loginIfNeededThen('LoginToFlag', post.nr, () => {
    morebundle.openFlagDialog(post.nr);
  });
}


function loginIfNeededThen(loginToWhat, postNr: PostNr, success: () => void) {
  login.loginIfNeededReturnToPost(loginToWhat, postNr, success);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
