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
/// <reference path="../dialogs.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../editor/title-editor.ts" />
/// <reference path="../edit-history/edit-history-dialog.ts" />
/// <reference path="../topbar/topbar.ts" />
/// <reference path="../page-dialogs/wikify-dialog.ts" />
/// <reference path="../page-dialogs/delete-post-dialog.ts" />
/// <reference path="../page-dialogs/see-wrench-dialog.ts" />
/// <reference path="../help/help.ts" />
/// <reference path="../model.ts" />
/// <reference path="chat.ts" />

//------------------------------------------------------------------------------
   module debiki2.page {
//------------------------------------------------------------------------------

var React = window['React']; // TypeScript file doesn't work
var r = React.DOM;
var $: JQueryStatic = debiki.internal.$;
var ReactBootstrap: any = window['ReactBootstrap'];


export var NoCommentsPageActions = createComponent({
  onEditClick: function(event) {
    debiki2.ReactActions.editPostWithNr(this.props.post.postId);
  },
  render: function() {
    var me: Myself = this.props.me;
    var post: Post = this.props.post;

    if (!post.isApproved && !post.sanitizedHtml)
      return null;

    var actions;
    if (me.isAdmin) {
      actions =
          r.a({ className: 'dw-a dw-a-edit icon-edit', onClick: this.onEditClick }, 'Edit');
    }

    return (
      r.div({ className: 'dw-p-as dw-as' }, actions));
  }
});


export var PostActions = createComponent({
  loginIfNeededThen: function(loginToWhat, callback) {
    var postNr = this.props.post.postNr;
    debiki.internal.loginIfNeeded(
        loginToWhat, debiki.internal.makeReturnToPostUrlForVerifEmail(postNr), callback);
  },
  onAcceptAnswerClick: function() {
    debiki2.ReactActions.acceptAnswer(this.props.post.uniqueId);
  },
  onUnacceptAnswerClick: function() {
    debiki2.ReactActions.unacceptAnswer();
  },
  onReplyClick: function(event) {
    // (Don't check this.props...isFlat here — use postType instead.)
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
    this.loginIfNeededThen('LoginToVote', () => {
      debiki.internal.$toggleVote('VoteLike').call(event.target, event);
    });
  },
  onWrongClick: function(event) {
    this.loginIfNeededThen('LoginToVote', () => {
      debiki.internal.$toggleVote('VoteWrong').call(event.target, event);
    });
  },
  onBuryClick: function(event) {
    this.loginIfNeededThen('LoginToVote', () => {
      debiki.internal.$toggleVote('VoteBury').call(event.target, event);
    });
  },
  onUnwantedClick: function(event) {
    this.loginIfNeededThen('LoginToVote', () => {
      debiki.internal.$toggleVote('VoteUnwanted').call(event.target, event);
    });
  },
  onEditSuggestionsClick: function(event) {
    debiki.internal.$showEditsDialog.call(event.target, event);
  },
  onFlagClick: function(event) {
    this.loginIfNeededThen('LoginToFlag', () => {
      debiki2.getFlagDialog().open(this.props.post.postId);
    });
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
  onSeeWrenchClick: function(event) {
    ReactActions.hideHelpMessageWithId('seeWrench');
    debiki2.pagedialogs.openSeeWrenchDialog();
  },

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
    var isFlat = this.props.store.isFlat; // hmm isFlat shouldn't be placed in store, oh well
    // (Some dupl code, see Title above and isDone() and isAnswered() in forum.ts [4KEPW2]
    var isAnswered = isQuestion && store.pageAnsweredAtMs;
    var isDone = store.pageDoneAtMs && (store.pageRole === PageRole.Problem ||
      store.pageRole === PageRole.Idea || store.pageRole === PageRole.ToDo);

    if (!post.isApproved) // what?:  && !post.text)
      return null;

    var me: Myself = store.me;
    var isOwnPost = post.authorIdInt === me.userId;
    var isPageBody = post.postId === BodyPostId;
    var votes = me.votes[post.postId] || [];
    var isStaffOrOwnPost: boolean = isStaff(me) || isOwnPost;

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
    var canCloseOrReopen = !isDone && !isAnswered && canClose(store.pageRole);
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
    if (isStaff(me) && post.numBuryVotes) {
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
        isFlat
            ? null // cannot change sort order or collapse flat comments
            : r.a({ className: 'dw-a dw-a-bury icon-bury' + myBuryVote,
              title: "Click if you think it's better that people spend their time " +
                  "reading other things instead.", onClick: this.onBuryClick }, 'Bury');
      var unwantedVoteButton = isGuest(me) ? null :
          r.a({ className: 'dw-a dw-a-unwanted icon-cancel' + myUnwantedVote,
              title: "Click if you do not want this comment on this site.",
                  onClick: this.onUnwantedClick }, "Unwanted");

      otherVotesDropdown = post.postId === BodyPostId ? null :
          r.span({ className: 'dropdown navbar-right', title: "More votes..." },
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
      var mayEdit = isStaff(me) || (
          me.isAuthenticated && post.postType === PostType.CommunityWiki);
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

    if (!isPageBody && isStaff(me)) {
      moreLinks.push(
        r.a({ className: 'dw-a dw-a-delete icon-trash', onClick: this.onDeleteClick, key: 'dl' },
          'Delete'));
    }

    if (isStaff(me) && !isFlat) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-users', onClick: this.onWikifyClick, key: 'wf' },
          isWikiPost(post) ? 'Un-Wikify' : 'Wikify'));
    }

    if (isPageBody && isStaff(me) && !help.isHelpMessageClosedAnyVersion(store, 'seeWrench')) {
      moreLinks.push(
        r.a({ className: 'dw-a icon-help-circled', onClick: this.onSeeWrenchClick, key: 'sw' },
          'Pin topic, move posts, etc'));
    }

    var moreDropdown =
      r.span({ className: 'dropdown navbar-right' },
        r.a({ className: 'dw-a dw-a-more icon-menu', 'data-toggle': 'dropdown', title: "More..." }),
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


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
