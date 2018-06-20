/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../editor-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


/** The review reasons are a 64 bit bitflag. See this Scala file for their meanings:
 *   modules/debiki-core/src/main/scala/com/debiki/core/ReviewReason.scala
 */
const ReviewReasons = {
  isByThreatUser: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 0),
  isByNewUser: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 1),
  newPost: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 4),
  noBumpPost: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 5),
  edit: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 6),
  lateEdit: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 7),
  postFlagged: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 8),
  postUnpopular: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 9),
  postIsSpam: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 10),
  userCreated: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 20),
  userNewAvatar: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 21),
  userNameEdited: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 22),
  userAboutTextEdited: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 23),
};


export const ReviewAllPanelComponent = createReactClass(<any> {
  displayName: 'ReviewAllPanelComponent',

  componentDidMount: function() {
    let promise: Promise<void> = Server.loadEditorAndMoreBundlesGetDeferred();
    Server.loadReviewTasks(reviewTasks => {
      promise.then(() => {
        if (this.isGone) return;
        const store = ReactStore.allData();
        this.setState({
          reviewTasks,
          store,
          nowMs: getNowMs(),
        });
        setTimeout(this.countdownUndoTimeout, 1000);
      });
    });
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  countdownUndoTimeout: function() {
    if (this.isGone) return;
    this.setState({ nowMs: getNowMs() });
    setTimeout(this.countdownUndoTimeout, 1000);
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    const store = this.state.store;

    const elems = this.state.reviewTasks.map((reviewTask: ReviewTask) => {
      return ReviewTask({ reviewTask, key: reviewTask.id, store, nowMs: this.state.nowMs });
    });

    if (!elems.length)
      return r.p({ className: 'esAdminSectionIntro' }, "No comments or replies to review.");

    return (
      r.div({ className: 'e_A_Rvw' },
        elems));
  }
});


// For now. Don't want to rerender.
const safeHtmlByMarkdownSource = {};


const ReviewTask = createComponent({
  displayName: 'ReviewTask',

  getInitialState: function() {
    return {};
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  // Returns [string, string[]]
  formatWhatAndWhys: function(): any[] {
    const reviewTask: ReviewTask = this.props.reviewTask;
    let what = reviewTask.pageId ? "The page below " : "The post below ";
    const whys = [];

    const post = this.props.reviewTask.post;
    if (!post.approvedRevNr) {
      what += "is hidden, waiting for approval, and ";
    }
    else if (post.approvedRevNr !== post.currRevNr) {
      what += "has edits waiting for approval, and ";
    }

    let who;
    if (ReviewReasons.isByNewUser(reviewTask)) {
      who = "a new user";
      if (ReviewReasons.isByThreatUser(reviewTask)) {
        who += " that sometimes misbehaves";
      }
    }
    else if (ReviewReasons.isByThreatUser(reviewTask)) {
      who = "a user that sometimes misbehaves";
    }

    if (ReviewReasons.newPost(reviewTask) && who) {
      whys.push("was posted by " + who);
    }

    if (ReviewReasons.noBumpPost(reviewTask)) {
      whys.push("was posted on a closed page, it might have gone unnoticed");
    }

    if (ReviewReasons.edit(reviewTask) && who) {
      whys.push("was edited by " + who);
    }
    if (ReviewReasons.lateEdit(reviewTask)) {
      whys.push("was edited long after it was created, no one might have noticed");
    }

    if (ReviewReasons.postFlagged(reviewTask)) {
      whys.push("has been flagged");
    }
    if (ReviewReasons.postUnpopular(reviewTask)) {
      whys.push("is unpopular (many downvotes)");
    }
    if (ReviewReasons.postIsSpam(reviewTask)) {
      whys.push("seems to be spam");
    }

    /* Later, when reviewing user profiles:
    This user is a new user, and sometimes misbehaves, and:
      was just created
      changed his/her avatar
      changed his/her name
      changed his/her about text */

    return [what, whys];
  },

  makeReviewDecision: function(decision: ReviewDecision) {
    const revisionNr = (this.props.reviewTask.post || {}).currRevNr;
    Server.makeReviewDecision(this.props.reviewTask.id, revisionNr, decision, () => {
      if (this.isGone) return;
      this.setState({
        justDecided: decision,
        justDecidedAtMs: getNowMs(),
        couldBeUndone: undefined,
      });
    });
  },

  undoReviewDecision: function() {
    // TESTS_MISSING  [4JKWWD4]
    Server.undoReviewDecision(this.props.reviewTask.id, (couldBeUndone: boolean) => {
      if (this.isGone) return;
      if (couldBeUndone) {
        this.setState({
          justDecided: null,
          justDecidedAtMs: null,
          couldBeUndone: true,
        });
      }
      else {
        this.setState({
          couldBeUndone: false,
        });
      }
    });
  },

  render: function() {
    const reviewTask: ReviewTask = this.props.reviewTask;
    const store: Store = this.props.store;

    const whatAndWhys: any[] = this.formatWhatAndWhys();
    const what: string = whatAndWhys[0];
    const whys: string[] = whatAndWhys[1];

    const post: PostToReview = reviewTask.post;

    const linkToPost = '/-'+ post.pageId + (post.nr >= FirstReplyNr ? '#post-'+ post.nr : '');
    const postOrPage = reviewTask.pageId ? "page" : "post";
    const openPostButton =
        r.a({ href: linkToPost, className: 's_A_Rvw_Tsk_ViewB', target: '_blank' },
          `Go to ${postOrPage}`);

    const decideTo = (action) => {
      return () => this.makeReviewDecision(action);
    };

    let taskDoneInfo;
    let undoDecisionButton;
    let gotUndoneInfo;
    let acceptButton;
    let rejectButton;

    if (this.state.justDecidedAtMs || reviewTask.decidedAtMs || reviewTask.completedAtMs) {
      const taskDoneBy: BriefUser | null = store.usersByIdBrief[reviewTask.completedById];
      const doneByInfo = !taskDoneBy ? null : r.span({}, " by ", UserName({ user: taskDoneBy, store }));
      let whatWasDone: string;
      switch (reviewTask.decision || this.state.justDecided) {
        case ReviewDecision.Accept: whatWasDone = " Accepted"; break;
        case ReviewDecision.DeletePostOrPage: whatWasDone = " Deleted"; break;
      }
      taskDoneInfo = r.span({ className: 'e_A_Rvw_Tsk_DoneInfo' }, whatWasDone, doneByInfo);
    }

    if (_.isBoolean(this.state.couldBeUndone)) {
      const className = 's_A_Rvw_Tsk_UndoneInf ' + (
          this.state.couldBeUndone ? 'e_A_Rvw_Tsk_Undone' : 'e_A_Rvw_Tsk_NotUndone');
      gotUndoneInfo = r.span({ className }, this.state.couldBeUndone ?
        " Undone." : " Could NOT be undone: Changes already made");
    }
    else if (!reviewTask.completedAtMs && (this.state.justDecidedAtMs || reviewTask.decidedAtMs)) {
      undoDecisionButton =
          UndoReviewDecisionButton({ justDecidedAtMs: this.state.justDecidedAtMs,
              reviewTask, nowMs: this.props.nowMs, undoReviewDecision: this.undoReviewDecision });
    }

    if (reviewTask.completedAtMs || reviewTask.decidedAtMs || this.state.justDecidedAtMs) {
      // Show no decision buttons. (Only maybe an Undo button, see above.)
    }
    else if (reviewTask.invalidatedAtMs) {
      // Hmm could improve on this somehow.
      acceptButton = r.span({}, " Invalidated, perhaps the post was deleted?");
    }
    else {
      const acceptText = post.approvedRevNr !== post.currRevNr ? "Approve" : "Looks fine";
      acceptButton =
          Button({ onClick: decideTo(ReviewDecision.Accept),
              className: 'e_A_Rvw_Tsk_AcptB' }, acceptText);
      rejectButton =
          Button({ onClick: decideTo(ReviewDecision.DeletePostOrPage),
              className: 'e_A_Rvw_Tsk_RjctB' }, "Delete");
    }


    let safeHtml: string;
    if (0 && post.currRevNr === post.approvedRevNr) {
      safeHtml = post.approvedHtmlSanitized;
    }
    else {
      // Need to render CommonMark source to html.
      // COULD create some markdown cache? Useful elsewhere too?
      // Or use React's shouldComponentUpdate().
      safeHtml = safeHtmlByMarkdownSource[post.currentSource];
      if (!safeHtml) {
        safeHtml = editor.markdownToSafeHtml(post.currentSource);  // [7PKEW24]
        safeHtmlByMarkdownSource[post.currentSource] = safeHtml;
      }
    }

    const anyDot = whys.length === 1 ? '.' : '';
    const manyWhysClass = whys.length > 1 ? ' esReviewTask-manyWhys' : '';

    const itHasBeenHidden = !post.bodyHiddenAtMs ? null :
      "It has been hidden; only staff can see it. ";

    const author = store.usersByIdBrief[post.createdById] || {};
    const writtenByInfo =
        r.div({ className: 's_RT_WrittenBy' },
          "Written by: ", UserName({ user: author, store }));

    const lastApprovedEditBy = !post.lastApprovedEditById ? null :
        store.usersByIdBrief[post.lastApprovedEditById] || {};
    const lastApprovedEditInfo = !lastApprovedEditBy ? null :
        r.div({ className: 's_RT_LastAprEditBy' },
          "Last approved edit by: ", UserName({ user: lastApprovedEditBy, store }));

    // Minor BUG: This duplicates all flags for this post, for each review task. But
    // there's one review task per flag.
    // Fix this, by grouping all old & resolved review tasks together,
    // and showing just one resolved review item, for those, & all related flags.
    // Plus one new review task, with all new flags.
    let flaggedByInfo;
    if (reviewTask.flags && reviewTask.flags.length) {
      flaggedByInfo =
        r.div({},
          r.div({ className: 's_RT_FlaggedBy'}, "Flagged by: "),
          r.ul({ className: 's_RT_Flags' },
            reviewTask.flags.map((flag: Flag) => {
              const flagger = store.usersByIdBrief[flag.flaggerId] || {};
              let reason = "Other";
              switch (flag.flagType) {
                case FlagType.Inapt: reason = "Inappropriate"; break;
                case FlagType.Spam: reason = "Spam"; break;
              }
              const oldFlag = reviewTask.completedAtMs < flag.flaggedAt ? '' : " (old flag)";
              const oldFlagClass = !oldFlag ? '' : ' s_RT_Flags_Flag-Old';
              const flagDummyId = `${flag.flaggedAt}|${flag.flaggerId}`; // [2PKRW08]
              return (
                r.li({ className: 's_RT_Flags_Flag' + oldFlagClass, key: flagDummyId },
                  UserName({ user: flagger, store }),
                  " reason: ",
                  reason,
                  ", on ",
                  whenMsToIsoDate(flag.flaggedAt),
                  oldFlag));
            })));
    }

    const hereIsThePost = whys.length > 1 || flaggedByInfo ? "Here it is:" : '';

    const anyPageTitleToReview = !reviewTask.pageId ? null :
      r.div({ className: 'esRT_TitleToReview' }, reviewTask.pageTitle);

    return (
      r.div({ className: 'esReviewTask' + manyWhysClass },
        r.div({},
          r.span({ className: 'esReviewTask_what' }, what),
          r.ul({ className: 'esReviewTask_whys' },
            whys.map((why) => r.li({ key: why }, why))),
          anyDot),
        r.div({},
          itHasBeenHidden,
          writtenByInfo,
          lastApprovedEditInfo,
          flaggedByInfo,
          hereIsThePost,
          r.div({ className: 'esReviewTask_it' },
            anyPageTitleToReview,
            r.div({ dangerouslySetInnerHTML: { __html: safeHtml }}))),
        r.div({ className: 'esReviewTask_btns' },
          openPostButton,
          taskDoneInfo,
          acceptButton,
          rejectButton,
          undoDecisionButton,
          gotUndoneInfo )));

    /* Later, something like?:

    What do you want to do?

    Leave as is / Approve it
      Looks fine, nothing is wrong with this post.

    Edit

    Send PM
      Sen a private message (PM) to the user if you want to ask him or her to change the post somehow.

    Delete

    View user
      On the user page, there's a button that deletes _all_ comments by this user.
      And you can ban him/her.
    */
  }
});


function UndoReviewDecisionButton(props: { justDecidedAtMs?: WhenMs, nowMs: WhenMs,
      undoReviewDecision, reviewTask: ReviewTask }) {
  const decidedAtMs = props.reviewTask.decidedAtMs || props.justDecidedAtMs;
  const deadlineMs = decidedAtMs + ReviewDecisionUndoTimoutSeconds * 1000;
  const millisLeft = props.reviewTask.completedAtMs ? 0 : (deadlineMs - props.nowMs);
  const secondsLeft = millisLeft / 1000;
  if (secondsLeft <= 0)
    return r.span({ className: 'e_A_Rvw_Tsk_NoUndo' }, " — done");

  return Button({ onClick: props.undoReviewDecision, className: 'e_A_Rvw_Tsk_UndoB' },
    `Undo (${ Math.floor(secondsLeft) })`);
}


// COULD move to some debiki-common.js or debiki-utils.js?
function escapeHtml(html: string) {
  // See https://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat, rule #1.
  // However, & < > should be enough, see: org.owasp.encoder.Encode.forHtmlContent().
  return html
   .replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;");
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
