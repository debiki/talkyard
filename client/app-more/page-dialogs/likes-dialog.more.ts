/*
 * Copyright (c) 2017 Kaj Magnus Lindberg
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
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;

let votesDialog;

export function openLikesDialog(post: Post, voteType: PostVoteType, at) {
  if (!votesDialog) {
    votesDialog = ReactDOM.render(VotesDialog(), utils.makeMountNode());
  }
  votesDialog.openForAt(post, voteType, at);
}


const VotesDialog = createComponent({
  displayName: 'VotesDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
      store: ReactStore.allData(),
    };
  },

  openForAt: function(post: Post, voteType: PostVoteType, at) {
    const rect = at.getBoundingClientRect();
    this.setState({
      isOpen: true,
      atX: rect.left - 140,
      atY: rect.bottom - 60,
      post: post,
      voteType: voteType,
    });
    this.loadVoters(post, voteType);
  },

  close: function() {
    this.setState({ isOpen: false, post: null, likes: null });
  },

  loadVoters: function(post: Post, voteType: PostVoteType) {
    Server.loadVoters(post.uniqueId, voteType, (numVoters: number, someVoters: BriefUser[]) => {
      if (!this.state.isOpen) return;
      this.setState({
        post: post,
        numVoters: numVoters,
        someVoters: someVoters,
      });
    });
  },

  render: function () {
    const state = this.state;
    const store: Store = this.state.store;
    const numVoters: number = state.numVoters;
    const voters: BriefUser[] = state.someVoters;
    const voteType: PostVoteType = state.voteType;
    let content;

    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (!voters) {
      content = r.p({}, "Loading ...");
    }
    else {
      const people = numVoters === 1 ? " person " : " people ";
      let didWhat: string;
      switch (voteType) {
        case PostVoteType.Like: didWhat = "liked"; break;
        case PostVoteType.Disagree: didWhat = "disagreed with"; break;
        case PostVoteType.Bury: didWhat = "buried"; break;
        case PostVoteType.Unwanted: didWhat = "unwanted"; break;
      }
      content = r.div({},
          r.p({ className: 's_VotesD_Title' }, numVoters + people + didWhat + " this post:"),
          r.div({ className: 's_VotesD_Voters' },
            voters.map(voter => avatar.Avatar({ user: voter, origins: store,
                size: AvatarSize.Small }))));
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true, showCloseButton: true, dialogClassName2: 's_VotesD' },
        content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
