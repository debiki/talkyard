/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

interface UserDraftProps {
  user: UserInclDetails;
  store: Store;
}

interface UserDraftState {
  error?: St | true;
  work?: ListDraftsResponse;
}


export const UserDrafts = createFactory({
  displayName: 'UserDrafts',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    const props: UserDraftProps = this.props;
    const user: UserInclDetails = props.user;
    this.listDrafts(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  // SHOULD Switch to componentDidUpdate instead, see  users-page.more.ts  for how.
  UNSAFE_componentWillReceiveProps: function(nextProps: UserDraftProps) {
    // Dupl code, also in view notfs. [7WUBKZ0]
    const props: UserDraftProps = this.props;
    const me: Myself = props.store.me;
    const user: UserInclDetails = props.user;
    const nextLoggedInUser: Myself = nextProps.store.me;
    const nextUser: UserInclDetails = nextProps.user;
    if (me.id !== nextLoggedInUser.id || user.id !== nextUser.id) {
      this.listDrafts(nextUser.id);
    }
  },

  listDrafts: function(userId: UserId) {
    // Dupl code, also in view notfs. [7WUBKZ0]
    const props: UserDraftProps = this.props;
    const me: Myself = props.store.me;

    if (me.id !== userId && !isStaff(me)) {
      this.setState({
        error: "May not list an other user's drafts. [TyE5ARBK2]",
        work: null,
      }); // satisfies UserDraftState);
      return;
    }

    Server.listDrafts(userId, (response: ListDraftsResponse) => {
      if (this.isGone) return;
      this.setState({
        error: null,
        work: response,
      }); // satisfies UserDraftState);
    }, () => {
      // Clear drafts, in case we're no longer allowed to view the drafts.
      this.setState({ error: true, work: null }); // satisfies UserDraftState);
    });
  },

  render: function() {
    const props: UserDraftProps = this.props;
    const state: UserDraftState = this.state;

    // Dupl code, also in view notfs. [7WUBKZ0]
    if (state.error)
      return (
        r.p({ className: 'e_Dfs-Err' },
          _.isString(state.error) ? state.error : "Error [EsE7YKW2]."));

    const work: ListDraftsResponse | NU = state.work;
    if (!work)
      return r.p({}, t.Loading);

    const drafts: Draft[] = work.drafts;
    const user: UserInclDetails = props.user;
    const store: Store = props.store;
    const me: Myself = store.me;
    const isMe = user.id === me.id;

    const anyNoDraftsMessage = drafts.length ? null :
        r.p({ className: 'e_Dfs_None' }, t.upp.NoDrafts);

    const draftElems = drafts.map((draft: Draft) =>
        r.li({ key: draft.draftNr },
          Draft({ draft, pageTitlesById: work.pageTitlesById,
            pagePostNrsByPostId: work.pagePostNrsByPostId })));

    return (
      r.div({ className: 'c_Dfs' },
        r.p({ className: 'c_Dfs_By' },
          isMe ? t.upp.YourDraftsC : t.upp.DraftsByC(user.username || user.fullName)),
        anyNoDraftsMessage,
        r.ol({ className: 's_Dfs' },
          draftElems)));
  }
});


function Draft(props: { draft: Draft, pageTitlesById: { [pageId: string]: string },
        pagePostNrsByPostId: { [postId: string]: [PageId, PostNr] } }) {
  const draft = props.draft;
  const forWhat: DraftLocator = draft.forWhat;

  const text = draft.text;
  let title = draft.title;
  let what;
  let pageId = forWhat.pageId;
  let postNr = forWhat.postNr;

  if (forWhat.postId) {
    // This draft is related to an already existing page and post.

    if (forWhat.draftType === DraftType.Reply ||
        forWhat.draftType === DraftType.ProgressPost) {
      if (draft.postType === PostType.ChatMessage) what = t.Chatting;
      else what = t.Replying;
    }
    else if (forWhat.draftType === DraftType.Edit) {
      what = t.Editing;
    }
    else {
      // @ifdef DEBUG
      die('TyE2ABK4701');
      // @endif
      what = `Draft type ${forWhat.draftType} [TyE5BZRJ2]`;
    }

    let postId = forWhat.postId;
    const pagePostNr = props.pagePostNrsByPostId[postId];
    pageId = pagePostNr[0];
    postNr = pagePostNr[1];
    title = `${t.TopicTitle}: ${props.pageTitlesById[pageId]}`;
  }
  else {
    // This draft is for a new page.

    title = `${t.TopicTitle}: ` + (title || `(${t.NoTitle})`);

    if (forWhat.draftType === DraftType.DirectMessage) {
      what = t.DirectMessage;
    }
    else if (forWhat.draftType === DraftType.Topic) {
      what = t.NewTopic;
    }
    else {
      // @ifdef DEBUG
      die('TyE2ABK4702');
      // @endif
      what = `Draft type ${forWhat.draftType} [TyE24GKA7B]`;
    }
  }

  let textTruncated = text.substr(0, 350);
  if (text.length > 350) {
    textTruncated += ' ...';
  }

  // Here, for a post, pageId is accurate also if the post was moved to an new page by staff.
  // Then, draft.pageId is the page where the draft was created — and pageId is where it's
  // located now, and to where we should go to resume writing.
  return (
    TyLink({ to: linkToDraftSource(draft, pageId, postNr), className: 's_Dfs_Df' },
      r.div({ className: 's_Dfs_Df_Wht' }, what ),
      r.div({ className: 's_Dfs_Df_Ttl' }, title),
      r.div({ className: 's_Dfs_Df_Txt' }, textTruncated)));
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
