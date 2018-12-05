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


export const UserDrafts = createFactory({
  displayName: 'UserDrafts',

  getInitialState: function() {
    return { drafts: null, error: null };
  },

  componentDidMount: function() {
    const user: MemberInclDetails = this.props.user;
    this.listDrafts(user.id);
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  // SHOULD Switch to componentDidUpdate instead, see  users-page.more.ts  for how.
  componentWillReceiveProps: function(nextProps: any) {
    // Dupl code, also in view notfs. [7WUBKZ0]
    const me: Myself = this.props.store.me;
    const user: MemberInclDetails = this.props.user;
    const nextLoggedInUser: Myself = nextProps.store.me;
    const nextUser: MemberInclDetails = nextProps.user;
    if (me.id !== nextLoggedInUser.id || user.id !== nextUser.id) {
      this.listDrafts(nextUser.id);
    }
  },

  listDrafts: function(userId: UserId) {
    // Dupl code, also in view notfs. [7WUBKZ0]
    const me: Myself = this.props.store.me;
    if (me.id !== userId && !isStaff(me)) {
      this.setState({
        error: "May not list an other user's drafts. [TyE5ARBK2]",
        drafts: null,
      });
      return;
    }
    Server.listDrafts(userId, (response: ListDraftsResponse) => {
      if (this.isGone) return;
      this.setState({
        error: null,
        drafts: response.drafts,
        pageTitlesById: response.pageTitlesById,
        pagePostNrsByPostId: response.pagePostNrsByPostId,
      });
    }, () => {
      // Clear state.drafts, in case we're no longer allowed to view the drafts.
      this.setState({ error: true, drafts: null });
    });
  },

  render: function() {
    // Dupl code, also in view notfs. [7WUBKZ0]
    if (this.state.error)
      return (
        r.p({ className: 'e_Dfs-Err' },
          _.isString(this.state.error) ? this.state.error : "Error [EsE7YKW2]."));

    const drafts: Draft[] = this.state.drafts;

    if (!drafts)
      return r.p({}, t.Loading);

    const user: MemberInclDetails = this.props.user;
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const isMe = user.id === me.id;

    const anyNoDraftsMessage = drafts.length ? null :
        r.p({ className: 'e_Dfs_None' }, "No drafts");  // I18N

    const draftElems = drafts.map((draft: Draft) =>
        r.li({ key: draft.draftNr },
          Draft({ draft, pageTitlesById: this.state.pageTitlesById,
            pagePostNrsByPostId: this.state.pagePostNrsByPostId })));

    return (
      r.div({},
        r.p({}, isMe ? "Your drafts:" : `Drafts by ${user.username || user.fullName}:`),  // I18N
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

    if (forWhat.draftType === DraftType.Reply) {
      if (draft.postType === PostType.ChatMessage) what = "Chatting"; // I18N
      else what = "Replying"; // I18N
    }
    else if (forWhat.draftType === DraftType.Edit) {
      what = "Editing"; // I18N
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
    title = "Topic title: " + props.pageTitlesById[pageId];  // I18N
  }
  else {
    // This draft is for a new page.

    title = "Your title: " + title || "(No title)";  // I18N

    if (forWhat.draftType === DraftType.DirectMessage) {
      what = "Direct message"; // I18N
    }
    else if (forWhat.draftType === DraftType.Topic) {
      what = "New forum topic"; // I18N
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
    Link({ to: linkToDraftSource(draft, pageId, postNr), className: 's_Dfs_Df' },
      r.div({ className: 's_Dfs_Df_Wht' }, what ),
      r.div({ className: 's_Dfs_Df_Ttl' }, title),
      r.div({ className: 's_Dfs_Df_Txt' }, textTruncated)));
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
