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

/// <reference path="../staff-prelude.staff.ts" />
/// <reference path="oop-method.staff.ts" />


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
  isByLowTrust: (reviewTask: ReviewTask) => reviewTask.reasonsLong & (1 << 2),
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


export const ReviewAllPanel = createFactory({
  displayName: 'ReviewAllPanel',

  getInitialState: function() {
    return {
      // UX COULD change to false — but then e2e tests break.
      hideComplTasks: false,
    };
  },

  componentDidMount: function() {
    let promise: Promise<void> = Server.loadEditorAndMoreBundlesGetDeferred();
    Server.loadReviewTasks(reviewTasks => {
      promise.then(() => {
        this.updateTaskList(reviewTasks);
      });
    });
    // Don't reload tasks too frequently — don't want to accidentally DoS attack the server :-/
    let debounceMs = 2500;
    // @ifdef DEBUG
    // Speedup for e2e tests.
    debounceMs = 500;
    // @endif
    this.reloadTaskListDebounced = _.debounce(this.reloadTaskListDebounced, debounceMs);
  },

  reloadTaskListDebounced: function() {
    Server.loadReviewTasks(this.updateTaskList)
  },

  updateTaskList: function(reviewTasks) {
    if (this.isGone) {
      // This previously happened because of a component-unmount bug [5QKBRQ],
      // resulting in the task list not updating itself properly (one would need to reload the page).
      return;
    }
    this.setState({
      reviewTasks,
      nowMs: getNowMs(),
    });
    setTimeout(this.countdownUndoTimeout, 1000);
  },

  componentWillUnmount: function() {
    console.debug("Unmounting ReviewAllPanel [TyD4WKBQ]"); // [5QKBRQ]
    this.isGone = true;
  },

  countdownUndoTimeout: function() {
    if (this.isGone) return;
    const nowMs = getNowMs();
    const tasks: ReviewTask[] = this.state.reviewTasks;
    const anyJustCompleted = _.some(tasks, (task: ReviewTask) => {
      if (task.completedAtMs || task.invalidatedAtMs || !task.decidedAtMs)
        return false;
      if (task.decidedAtMs + ReviewDecisionUndoTimoutSeconds * 1000 < nowMs) {
        // This task was just carried out by the server. Then its status, and maybe also the
        // status of *other* tasks, has changed — so reload all tasks.
        // (How can other tasks be affected? Example: If the review decision was to delete
        // a whole page, review tasks for other posts on the page, then get invalidated.)
        // Maybe we'll reload all tasks too soon? Before the server is done? Then the
        // server should reply with the not-yet-completed tasks, resulting in us
        // reloading again, after the debounce delay.
        return true;
      }
    });

    if (anyJustCompleted) {
      this.reloadTaskListDebounced();  // [2WBKG7E]
    }

    this.setState({ nowMs });
    setTimeout(this.countdownUndoTimeout, 1000);
  },

  render: function() {
    if (!this.state.reviewTasks)
      return r.p({}, "Loading...");

    const store: Store = this.props.store;

    let elems = this.state.reviewTasks.map((reviewTask: ReviewTask, index: number) => {
      if (this.state.hideComplTasks && reviewTask_doneOrGone(reviewTask))
        return null;
      return ReviewTask({ reviewTask, key: reviewTask.id, updateTaskList: this.updateTaskList,
          store, nowMs: this.state.nowMs, taskIndex: index });
    });

    if (!_.some(elems, x => x))  // maybe null items, see above
      elems = r.p({ className: 'esAdminSectionIntro' }, "No comments or replies to review.");

    const helpText = help.HelpMessageBox({ message: <HelpMessage> {
      alwaysShow: true,
      content: rFragment({},
        r.p({},
          "Here you can moderate contents people submit, or that got reported. " +
          "E.g. approve or delete new posts."),
        Link({ to: linkToAdminPageModerationSettings() },
          "Moderation settings ..."))
      },
    });

    const hideComplTasks =
      Input({ type: 'checkbox', checked: this.state.hideComplTasks,
        className: 'e_HideCompl',
        onChange: (event) => this.setState({ hideComplTasks: event.target.checked }),
        label: "Hide completed review tasks" });

    return (
      r.div({ className: 's_A_Rvw' },
        helpText,
        hideComplTasks,
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

    const isNewUser = ReviewReasons.isByNewUser(reviewTask);
    const isThreat = ReviewReasons.isByThreatUser(reviewTask);
    const isLowTrust = ReviewReasons.isByLowTrust(reviewTask);

    let riskyUser: string | U;
    if (isNewUser || isThreat || isLowTrust) {
      riskyUser = isNewUser ? "a New user" : "a user";
      // UX "bug": Trust level might not be low though!
      // Configurable in requireApprovalIfTrustLte.
      if (isLowTrust) riskyUser += " with low trust level";
      if (isThreat) riskyUser += " who sometimes misbehaves";
    }

    // ----- New post?

    if (ReviewReasons.newPost(reviewTask) && riskyUser) {
      whys.push("was posted by " + riskyUser);
    }

    if (ReviewReasons.noBumpPost(reviewTask)) {
      whys.push("was posted on a closed page, it might have gone unnoticed");
    }

    // ----- Edits?

    if (ReviewReasons.edit(reviewTask) && riskyUser) {
      whys.push("was edited by " + riskyUser);
    }

    if (ReviewReasons.lateEdit(reviewTask)) {
      whys.push("was edited long after it was created, no one might have noticed");
    }

    // ----- Bad post?

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
    Server.makeReviewDecision(this.props.reviewTask.id, revisionNr, decision, this.props.updateTaskList);
    /*
          (alreadyDecided?: { decision: ReviewDecision, decidedAtMs: WhenMs }) => {
      if (this.isGone) return;
      this.setState({
        justDecided: decision,        CLEAN_UP remove this field
        justDecidedAtMs: getNowMs(),  CLEAN_UP remove this field
        couldBeUndone: undefined,     CLEAN_UP remove this field
      });
    }); */
  },

  undoReviewDecision: function() {
    // TESTS_MISSING  [4JKWWD4]
    Server.undoReviewDecision(this.props.reviewTask.id, this.props.updateTaskList); /*(couldBeUndone: boolean) => {
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
    }); */
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

    let taskInvalidatedInfo;
    let taskDoneInfo;
    let undoDecisionButton;
    let gotUndoneInfo;
    let acceptButton;
    let rejectButton;

    const deletedBy = !post.deletedById ? null : store_getUserOrMissing(store, post.deletedById);
    const itHasBeenDeleted = !post.deletedAtMs ? null :
      r.span({}, "It was deleted by ", UserName({ store, user: deletedBy, avoidFullName: true }), ". ");

    // (Currently, name of anyone who deleted the page, isn't available: deletedById not saved
    // in page meta. Only in audit log. Hmm.)
    const pageMeta: PageMetaBrief = store.pageMetaBriefById[post.pageId];
    const pageHasBeenDeleted = !pageMeta || !pageMeta.deletedAtMs ? null :
      r.span({}, "The page has been deleted. ");

    // Skip pageHasBeenDeleted and itHasBeenDeleted — let's review those posts anyway?
    // So staff get more chances to block bad users early. [5RW2GR8]
    const isInvalidated = !reviewTask.completedAtMs && reviewTask.invalidatedAtMs;

    if (isInvalidated) {
      taskInvalidatedInfo =
          r.span({ className: 'e_A_Rvw_Tsk_DoneInfo' },
            itHasBeenDeleted || "Invalidated [TyM5WKBAX2]");
            // pageHasBeenDeleted);  [5RW2GR8]
    }
    else if (this.state.justDecidedAtMs || reviewTask.decidedAtMs || reviewTask.completedAtMs) {
      const taskDoneBy: BriefUser | null = store.usersByIdBrief[reviewTask.decidedById];
      const doneByInfo = !taskDoneBy ? null : r.span({}, " by ", UserName({ user: taskDoneBy, store }));
      let whatWasDone: string;
      switch (reviewTask.decision || this.state.justDecided) {
        case ReviewDecision.Accept: whatWasDone = " Accepted"; break;
        case ReviewDecision.DeletePostOrPage: whatWasDone = " Deleted"; break;
      }
      taskDoneInfo = r.span({ className: 'e_A_Rvw_Tsk_DoneInfo' }, whatWasDone, doneByInfo);
    }

    if (reviewTask.invalidatedAtMs) {
      // Show no undo info or button — that't be confusing, when, for example, the post, or
      // the whole page, has been deleted (and therefore this task got invalidated).
    }/*
    else if (_.isBoolean(this.state.couldBeUndone)) {  CLEAN_UP remove this if-else
      const className = 's_A_Rvw_Tsk_UndoneInf ' + (
          this.state.couldBeUndone ? 'e_A_Rvw_Tsk_Undone' : 'e_A_Rvw_Tsk_NotUndone');
      gotUndoneInfo = r.span({ className }, this.state.couldBeUndone ?
        " Undone." : " Could NOT be undone: Changes already made");
    }*/
    else if (!reviewTask.completedAtMs && (this.state.justDecidedAtMs || reviewTask.decidedAtMs)) {
      undoDecisionButton =
          UndoReviewDecisionButton({ justDecidedAtMs: this.state.justDecidedAtMs,
              reviewTask, nowMs: this.props.nowMs, undoReviewDecision: this.undoReviewDecision });
    }

    if (reviewTask.completedAtMs || reviewTask.decidedAtMs || this.state.justDecidedAtMs
          || isInvalidated) {
      // Show no decision buttons. (But maybe an Undo button, see above.)
    }
    else {
      // UX should maybe be an undelete button? And a ban-bad-user button?
      const acceptText = post.approvedRevNr !== post.currRevNr ? "Approve" : "Looks fine";
      acceptButton = itHasBeenDeleted ? null : // won't undelete it
          Button({ onClick: decideTo(ReviewDecision.Accept),
              className: 'e_A_Rvw_Tsk_AcptB' }, acceptText);
      rejectButton =
          Button({ onClick: decideTo(ReviewDecision.DeletePostOrPage),
              className: 'e_A_Rvw_Tsk_RjctB' },
            itHasBeenDeleted ? "Do nothing (already deleted)" : "Delete");
    }


    let safeHtml: string;
    if (0 && post.currRevNr === post.approvedRevNr) {  // what? why 0, = disables approvedHtmlSanitized?
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

    const itHasBeenHidden = !post.bodyHiddenAtMs || isInvalidated ? null :
      "It has been hidden; only staff can see it. ";

    const author = store_getUserOrMissing(store, post.createdById);
    const writtenByInfo =
        r.div({ className: 's_RT_WrittenBy' },
          "Written by: ", UserName({ user: author, store }));

    const lastApprovedEditBy = !post.lastApprovedEditById ? null :
        store_getUserOrMissing(store, post.lastApprovedEditById);

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
              const flagger = store_getUserOrMissing(store, flag.flaggerId);
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

    // (If pageHasBeenDeleted, then sth like "Page deleted" is shown just above hereIsThePost
    // — then, don't use the word "it", because would be unclear if referred to the page, or the post.)
    const hereIsThePost = pageHasBeenDeleted ? "Here is the post:" : (
        whys.length > 1 || flaggedByInfo ? "Here it is:" : '');

    const anyPageTitleToReview = !reviewTask.pageId ? null :
      r.div({ className: 'esRT_TitleToReview' }, reviewTask.pageTitle);

    // For end-to-end tests.
    const isWaitingClass = acceptButton || rejectButton ? ' e_Wtng' : ' e_NotWtng';
    const isDeletedClass = itHasBeenDeleted ? ' e_P-Dd' : '';
    const pageIdPostNrIndexClass =
      ' e_Pg-Id-' + post.pageId +
      ' e_P-Nr-' + post.nr +
      ' e_RT-Ix-' + (this.props.taskIndex + 1); // let's start at 1? Simpler when writing e2e code?
    const e2eClasses = pageIdPostNrIndexClass + isDeletedClass + isWaitingClass;

    const numVotes =
        post.numLikeVotes + post.numWrongVotes + post.numBuryVotes + post.numUnwantedVotes;
    // COULD make the vote counts clickable, and show who liked / disagreed etc
    // — reuse openLikesDialog().
    const votes = !numVotes ? null :
        r.div({ className: 's_RT_Vts' },
          r.span({}, "Votes: "),
          r.ul({},
            !post.numLikeVotes ? null :
                r.li({ className: 's_RT_Vts_Vt' }, `${post.numLikeVotes} Like`),
            !post.numWrongVotes ? null :
                r.li({ className: 's_RT_Vts_Vt' }, `${post.numWrongVotes} Disagree`),
            !post.numBuryVotes ? null :
                r.li({ className: 's_RT_Vts_Vt' }, `${post.numBuryVotes} Bury`),
            !post.numUnwantedVotes ? null :
                r.li({ className: 's_RT_Vts_Vt' }, `${post.numUnwantedVotes} Unwanted`)));

    return (
      r.div({ className: 'esReviewTask' + manyWhysClass + e2eClasses },
        r.div({},
          r.span({ className: 'esReviewTask_what' }, what),
          r.ul({ className: 'esReviewTask_whys' },
            whys.map((why) => r.li({ key: why }, why))),
          anyDot),
        r.div({},
          writtenByInfo,
          lastApprovedEditInfo,
          flaggedByInfo,
          itHasBeenHidden,
          itHasBeenDeleted,
          pageHasBeenDeleted,
          hereIsThePost,
          r.div({ className: 'esReviewTask_it' },
            anyPageTitleToReview,
            r.div({ dangerouslySetInnerHTML: { __html: safeHtml }}))),
        votes,
        r.div({ className: 'esReviewTask_btns' },
          openPostButton,
          taskInvalidatedInfo,
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

  return Button({ onClick: props.undoReviewDecision, className: 's_A_Rvw_Tsk_UndoB' },
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
