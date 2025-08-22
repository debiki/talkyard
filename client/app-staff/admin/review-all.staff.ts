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
const UserNameLink = debiki2.UserNameLink;


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

interface ReviewAllPanelProps extends AdminPanelProps, ReactRouterProps {
}


interface ReviewAllPanelState {
  reviewTasks?: ReviewTask[]
  isLoading?: Bo
  hideComplTasks: Bo
  onlyPatId?: PatId
  onlyPat?: Pat
  notFoundId?: PatId
  spammersById?: { [patId: PatId]: true }
  nowMs?: WhenMs
  showComplicated?: Bo
}


export const ReviewAllPanel = createFactory({
  displayName: 'ReviewAllPanel',

  getInitialState: function() {
    const props: ReviewAllPanelProps = this.props;
    const queryParams = new URLSearchParams(props.location.search);
    const anyPatIdSt: St | U = queryParams.get('patId');
    const anyPatId = anyPatIdSt && parseInt(anyPatIdSt);
    // (0 —> undefined = everyone, fine.)
    const onlyPatId = anyPatId && !isNaN(anyPatId) ? anyPatId : undefined;
    return {
      // UX COULD change to false — but then e2e tests break.
      hideComplTasks: false,
      onlyPatId,
      showComplicated: !!queryParams.get('showComplicated'),
    } satisfies ReviewAllPanelState;
  },

  componentDidMount: function() {
    let promise: Promise<void> = Server.loadEditorAndMoreBundlesGetDeferred();
    const state: ReviewAllPanelState = this.state;
    const filter: ReviewTaskFilter = {  // could _break_out_filter
      onlyPending: state.hideComplTasks,
      patId: state.onlyPatId,
    };
    Server.loadReviewTasks(filter, (reviewTasks: ReviewTask[]) => {
      promise.then(() => {
        this.updateTaskList(reviewTasks);
      });
    });

    // Pat `onlyPatId` won't have been loaded above, if there aren't any mod tasks about han.
    if (state.onlyPatId) {
      const loadingId = state.onlyPatId;
      this.loadingPatId = loadingId;
      Server.loadPatVvbPatchStore(loadingId, (resp: LoadPatVvbResponse | NotFoundResponse) => {
        if (this.isGone) return;
        this.loadingPatId = null; // (or only if correct id)
        const newState: Partial<ReviewAllPanelState> = resp === 404
              ? { onlyPat: null, notFoundId: loadingId }
              : { onlyPat: resp.user, notFoundId: null };
        this.setState(newState);
      });
    }

    // Don't reload tasks too frequently — don't want to accidentally DoS attack the server :-/
    let debounceMs = 2500;
    // @ifdef DEBUG
    // Speedup for e2e tests.
    debounceMs = 500;
    // @endif
    this.reloadTaskListDebounced = _.debounce(this.reloadTaskListDebounced, debounceMs);
  },

  reloadTaskListDebounced: function() {
    const state: ReviewAllPanelState = this.state;
    const filter: ReviewTaskFilter = {  // could _break_out_filter
      onlyPending: state.hideComplTasks,
      patId: state.onlyPatId,
    };
    // (Could update `state.isLoading`)
    Server.loadReviewTasks(filter, this.updateTaskList)
  },

  // (Not debounced, oh well.)
  reloadWithNewFilter: function(ps: { hideComplTasks: Bo }) {
    const state: ReviewAllPanelState = this.state;
    const filter: ReviewTaskFilter = {  // could _break_out_filter
      onlyPending: ps.hideComplTasks,
      patId: state.onlyPatId,
    };
    this.setState({ isLoading: true });
    Server.loadReviewTasks(filter, (tasks: ReviewTask[]) => {
      this.setState({ ...ps, isLoading: false });
      this.updateTaskList(tasks);
    });
  },

  updateTaskList: function(reviewTasks: ReviewTask[]) {
    if (this.isGone) {
      // This previously happened because of a component-unmount bug [5QKBRQ],
      // resulting in the task list not updating itself properly (one would need to reload the page).
      return;
    }

    // Find ids of spammers we've decided to ban already, so can skip ban buttons.
    const spammersById: { [patId: PatId]: true } = {};
    const tasksBanningNow = reviewTasks.filter(t =>
            t.decision === ReviewDecision.DeleteAndBanSpammer && !t.completedAtMs);
    for (let t of tasksBanningNow) {
      const post: PostToReview = t.post;
      if (post.createdById !== post.currRevComposedById) {
        // Then which one is the spammer?
        continue;
      }
      spammersById[post.createdById] = true;
    }

    this.setState({
      reviewTasks,
      spammersById,
      nowMs: getNowMs(),
    } satisfies Partial<ReviewAllPanelState>);
    setTimeout(this.countdownUndoTimeout, 1000);
  },

  componentWillUnmount: function() {
    console.debug("Unmounting ReviewAllPanel [TyD4WKBQ]"); // [5QKBRQ]
    this.isGone = true;
  },

  countdownUndoTimeout: function() {
    if (this.isGone) return;
    const nowMs = getNowMs();
    const state: ReviewAllPanelState = this.state;
    const tasks: ReviewTask[] = state.reviewTasks;
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

  acceptAllUnreviewed: function() {
    util.openDefaultStupidDialog({
      dialogClassName: 'e_AcptAllD',
      body: "Accept all? (actually, 100 at a time)",  // [mod_acpt_all_limit]
      primaryButtonTitle: "Yes, bulk accept",
      secondaryButonTitle: "No, cancel",
      small: true,
      onPrimaryClick: () => {
        const state: ReviewAllPanelState = this.state;
        const filter: ReviewTaskFilter = {  // could _break_out_filter
          onlyPending: state.hideComplTasks,
          patId: state.onlyPatId,
        };
        // TESTS_MISSING  TyTMODACPTUNREV
        Server.acceptAllUnreviewed(filter, this.updateTaskList);
      },
    });
  },

  render: function() {
    const state: ReviewAllPanelState = this.state;
    if (!state.reviewTasks)
      return r.p({}, "Loading...");

    const props: ReviewAllPanelProps = this.props;
    const store: Store = props.store;

    let elems = state.reviewTasks.map((reviewTask: ReviewTask, index: number) => {
      if (state.hideComplTasks && reviewTask_doneOrGone(reviewTask))
        return null;
      const isSpammer = state.spammersById[reviewTask.post?.createdById];
      const filter: ReviewTaskFilter = {  // could _break_out_filter
        onlyPending: state.hideComplTasks,
        patId: state.onlyPatId,
      };
      return ReviewTask({ reviewTask, key: reviewTask.id, isSpammer,
          updateTaskList: this.updateTaskList,
          store, nowMs: state.nowMs, taskIndex: index, filter });
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
      Input({ type: 'checkbox', checked: state.hideComplTasks,
        className: 'e_HideCompl',
        disabled: state.isLoading,
        onChange: (event) => {
          const hideComplTasks = event.target.checked;
          this.reloadWithNewFilter({ hideComplTasks });
        },
        label: "Hide completed moderation tasks" });

    return (
      r.div({ className: 's_A_Rvw' },
        helpText,

        !state.notFoundId ? null :
              r.div({ className: 's_A_Rvw_PatNF' },
                `User id ${state.notFoundId} not found.`),
        !state.onlyPat ? null :
              r.div({ className: 's_A_Rvw_Pat' },
                r.h3({}, "Moderation tasks related to:  ", // '...to:&thinsp;'
                    LinkToPatAdminArea(state.onlyPat))),

        r.div({ className: '' },
          hideComplTasks,
          // This is usually a bad idea! Only show, if ?showComplicated(=true) in a query param.
          !state.showComplicated ? null : r.div({},
              Button({ onClick: () => this.acceptAllUnreviewed(), className: 'e_AcptAllB' },
                  "Accept all review tasks"),
              r.span({ className: 'help-block' },
                "You can bulk accept all, without review, if you're confident there are no issues.")),
          // Later?:  Break out [query_field_and_q_param]?
          // Input({ label: "Username filter", ... }),
          // Input({ label: "Email filter", ... }),
          ),

        elems));
  }
});


interface ReviewTaskProps {
  key: St | Nr
  store: Store
  nowMs: WhenMs
  reviewTask: ReviewTask
  taskIndex: Nr
  filter: ReviewTaskFilter
  isSpammer?: Bo
  updateTaskList: (reviewTasks: ReviewTask[]) => V
}


interface ReviewTaskState {
  justDecidedAtMs?: Nr;
}


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
  formatWhatAndWhys: function(reviewTask: ReviewTask, pageMeta: PageMetaBrief): any[] {
    const post: PostToReview = reviewTask.post;
    // Is it better with the link here? Or _link_after?
    // const linkToPost = '/-'+ post.pageId + (post.nr >= FirstReplyNr ? '#post-'+ post.nr : '');
    // const theWhatLink =
    //         r.a({ href: linkToPost, className: 's_A_Rvw_Tsk_ViewB', target: '_blank' },
    //           reviewTask.pageId ? "The page below " : "The post below ");

    let what = reviewTask.pageId ? "The page below " : "The post below ";
    const whys = [];

    if (post.deletedById) {
      what += "has been deleted. It ";
    }
    else if (pageMeta?.deletedAtMs) {
      what += post.nr >= FirstReplyNr
            ? "is deleted, because the page has been deleted. It "
            : "has been deleted. It ";
    }
    else if (!post.approvedRevNr) {
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

    //return [r.span({}, theWhatLink, what), whys];
    return [what, whys];
  },

  makeReviewDecision: function(decision: ReviewDecision) {
    const revisionNr = (this.props.reviewTask.post || {}).currRevNr;
    const props: ReviewTaskProps = this.props;
    Server.makeReviewDecision({ taskId: props.reviewTask.id, revisionNr,
          decision, filter: props.filter }, props.updateTaskList);
    /*
          (alreadyDecided?: { decision: ReviewDecision, decidedAtMs: WhenMs }) => {
      if (this.isGone) return;
      this.setState({
        justDecidedAtMs: getNowMs(),  CLEAN_UP remove this field
        couldBeUndone: undefined,     CLEAN_UP remove this field
      });
    }); */
  },

  undoReviewDecision: function() {
    // TESTS_MISSING  [4JKWWD4]
    const props: ReviewTaskProps = this.props;
    Server.undoReviewDecision({ taskId: props.reviewTask.id, filter: props.filter },
          props.updateTaskList); /*(couldBeUndone: boolean) => {
      if (this.isGone) return;
      if (couldBeUndone) {
        this.setState({
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
    const props: ReviewTaskProps = this.props;
    const reviewTask: ReviewTask = props.reviewTask;
    const store: Store = props.store;
    const state: ReviewTaskState = this.state;

    const post: PostToReview = reviewTask.post;

    // (Currently, the name of anyone who deleted the page, isn't available: deletedById
    // isn't saved in page meta. Only in the audit log. Hmm.)
    const pageMeta: PageMetaBrief | U = store.pageMetaBriefById[post.pageId];

    const whatAndWhys: any[] = this.formatWhatAndWhys(reviewTask, pageMeta);
    const what: RElm = whatAndWhys[0];
    const whys: string[] = whatAndWhys[1];

    const author = store_getUserOrMissing(store, post.createdById);

    const authorIsBannedSpammer: Bo = pat_isBanned(author) || props.isSpammer;

    // Is it better with the go-to _link_after the post, or in the text, before?
    const linkToPost = '/-'+ post.pageId + (post.nr >= FirstReplyNr ? '#post-'+ post.nr : '');
    const postOrPage = reviewTask.pageId ? "page" : "post";
    const openPostButton =
        r.a({ href: linkToPost, className: 's_A_Rvw_Tsk_ViewB', target: '_blank' },
          `Go to ${postOrPage}`);

    const decideTo = (action: ReviewDecision) => {
      return () => this.makeReviewDecision(action);
    };

    let taskInvalidatedInfo: RElm | U;
    let taskDoneInfo: RElm | U;
    let undoDecisionButton: RElm | U;
    let gotUndoneInfo: RElm | U;
    let acceptButton: RElm | U;
    let rejectButton: RElm | U;
    let banSpammerBtn: RElm | U;

    const deletedBy = !post.deletedById ? null : store_getUserOrMissing(store, post.deletedById);
    const itHasBeenDeleted = !post.deletedAtMs ? null :
        r.span({}, "It was deleted by ",
            UserNameLink({ store, user: deletedBy, avoidFullName: true }), ". ");

    // Don't check itHasBeenDeleted — let's review those posts anyway?
    // So staff get more chances to block bad users early. [deld_post_mod_tasks]
    const isInvalidated = !reviewTask.completedAtMs && reviewTask.invalidatedAtMs;
    const doneOrGoneClass = reviewTask_doneOrGone(reviewTask) ? 'e_TskDoneGone' : '';

    if (isInvalidated) {
      taskInvalidatedInfo = itHasBeenDeleted ? null : // incl elsewhere always
          r.span({ className: doneOrGoneClass },
            "Invalidated [TyM5WKBAX2]");
    }
    else if (state.justDecidedAtMs || reviewTask.decidedAtMs || reviewTask.completedAtMs) {
      const decider: BriefUser | U = store.usersByIdBrief[reviewTask.decidedById];
      const byWho = !decider ? null :
              r.span({}, " by ", UserNameLink({ user: decider, store }));
      let whatWasDone: St;
      switch (reviewTask.decision) {
        case ReviewDecision.Accept: whatWasDone = " Accepted"; break;
        case ReviewDecision.InteractEdit: whatWasDone = " Seems fine: Edited"; break;
        case ReviewDecision.InteractReply: whatWasDone = " Seems fine: Replied to"; break;
        case ReviewDecision.InteractAcceptAnswer: whatWasDone = " Seems fine: Answer accepted"; break;
        case ReviewDecision.InteractWikify: whatWasDone = " Seems fine: Wikified"; break;
        //case ReviewDecision.InteractTopicDoingStatus: whatWasDone = " Seems fine: ... ?"; break;
        case ReviewDecision.InteractLike: whatWasDone = " Seems fine: Liked"; break;
        case ReviewDecision.AcceptUnreviewedId: whatWasDone = " Accepted without review"; break;
        case ReviewDecision.DeletePostOrPage: whatWasDone = " Deleted"; break;
        case ReviewDecision.DeleteAndBanSpammer: whatWasDone = " Deleted, author banned,"; break;
        default: whatWasDone = 'TyEWAWADON';
      }
      taskDoneInfo = r.span({ className: doneOrGoneClass }, whatWasDone, byWho);
    }
    else if (authorIsBannedSpammer) {
      taskDoneInfo = r.span({ className: doneOrGoneClass }, "Author banned as spammer");
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
    else if (!reviewTask.completedAtMs && (state.justDecidedAtMs || reviewTask.decidedAtMs)) {
      undoDecisionButton =
          UndoReviewDecisionButton({ justDecidedAtMs: state.justDecidedAtMs,
              reviewTask, nowMs: props.nowMs, undoReviewDecision: this.undoReviewDecision });
    }

    if (reviewTask.completedAtMs || reviewTask.decidedAtMs || state.justDecidedAtMs
          || isInvalidated) {
      // Show no decision buttons. (But maybe an Undo button, see above.)
    }
    else if (authorIsBannedSpammer) {
      // Hans posts will be auto deleted when the DeleteAndBanSpammer decision gets
      // carried out. (So, show no buttons.)  [hide_ban_btns]
    }
    else {
      // UX should maybe be an undelete button?
      const acceptText = post.approvedRevNr !== post.currRevNr ? "Approve" : "Looks fine";
      acceptButton = itHasBeenDeleted ? null : // won't undelete it
          Button({ onClick: decideTo(ReviewDecision.Accept),
              className: 'e_A_Rvw_Tsk_AcptB' }, acceptText);

      rejectButton =
          Button({ onClick: decideTo(ReviewDecision.DeletePostOrPage),
              className: 'e_A_Rvw_Tsk_RjctB' },
            itHasBeenDeleted ? "Do nothing (already deleted)" : "Delete");

      const isNewUser = ReviewReasons.isByNewUser(reviewTask);
      banSpammerBtn = itHasBeenDeleted || !isNewUser ? null :
          Button({ onClick: decideTo(ReviewDecision.DeleteAndBanSpammer),
              className: 'e_A_Rvw_Tsk_BanB' },
            "Delete and ban spammer");
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

    const writtenByInfo =
        r.div({ className: 's_RT_WrittenBy' },
          "Posted by: ", UserNameLink({ user: author, store }));

    const lastApprovedEditBy = !post.lastApprovedEditById ? null :
        store_getUserOrMissing(store, post.lastApprovedEditById);

    const lastApprovedEditInfo = !lastApprovedEditBy ? null :
        r.div({ className: 's_RT_LastAprEditBy' },
          "Last approved edit by: ", UserNameLink({ user: lastApprovedEditBy, store }));

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
                  UserNameLink({ user: flagger, store }),
                  " reason: ",
                  reason,
                  ", on ",
                  whenMsToIsoDate(flag.flaggedAt),
                  oldFlag));
            })));
    }

    /* This is a bit chatty, let's remove?
    const hereIsThePost = pageHasBeenDeleted ? "Here is the post:" : (
        whys.length > 1 || flaggedByInfo ? "Here it is:" : '');
      */

    const anyPageTitleToReview = !reviewTask.pageId ? null :
      r.div({ className: 'esRT_TitleToReview' }, reviewTask.pageTitle);

    // For end-to-end tests.
    const isWaitingClass = acceptButton || rejectButton ? ' e_Wtng' : ' e_NotWtng';
    const isDeletedClass = itHasBeenDeleted ? ' e_P-Dd' : '';
    const pageIdPostNrIndexClass =
      ' e_Pg-Id-' + post.pageId +
      ' e_P-Nr-' + post.nr +
      ' e_RT-Ix-' + (props.taskIndex + 1); // let's start at 1? Simpler when writing e2e code?
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
          //hereIsThePost,
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
          banSpammerBtn,
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



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
