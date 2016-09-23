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

/// <reference path="../../typedefs/react/react.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------
/*
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];

Now I use ReviewTask instead. But keep this for a while, have a look at the approve/reject
edits code for example. Probably useless but ... perhaps

export var ReviewPostsPanelComponent = React.createClass(<any> {
  componentDidMount: function() {
    Server.loadRecentPosts(posts => {
      this.setState({ posts: posts });
    });
  },

  render: function() {
    if (!this.state)
      return r.p({}, 'Loading...');

    var now = Date.now();
    var postsElems = this.state.posts.map((post: PostToModerate) => {
      return Post({ post: post, now: now, key: post.id });
    });

    return (
      r.div({ id: 'details' },
        r.table({ className: 'table' },
          r.thead({},
            r.tr({},
              r.th({}, 'Activity'),
              r.th({}, 'Author'),
              r.th({}, 'Date'),
              r.th({}, 'Text'))),
          r.tbody({},
            postsElems))));
  }
});



var Post = createComponent({
  getInitialState: function() {
    var post: PostToModerate = this.props.post;
    var state = {
      status: post.status,
      approveBtnText: '',
      hideDeleteBtn: true,
      hideRejectEditsBtn: true,
      hideViewSuggsLink: true,
      numHandledFlags: post.numHandledFlags,
      numPendingFlags: post.numPendingFlags,
      pendingFlags: post.pendingFlags,
    }
    if (!state.pendingFlags || state.pendingFlags.length === 0) {
      switch (post.status) {
        case 'Deleted':
        case 'Hidden':
          state.hideDeleteBtn = true;
          break;
        case 'NewPrelApproved':
        case 'EditsPrelApproved':
          state.approveBtnText = 'Okay';
          state.hideDeleteBtn = false;
          break;
        case 'New':
          state.approveBtnText = 'Approve';
          state.hideDeleteBtn = false;
          break;
        case 'NewEdits':
          state.approveBtnText = 'Approve';
          state.hideRejectEditsBtn = false;
          break;
        default:
          state.hideViewSuggsLink = this.numPendingEditSuggestions == 0;
      }
    }
    return state;
  },

  url: function() {
    return '/-'+ this.props.post.pageId +'#post-'+ this.props.post.id;
  },

  description: function() {
    var what;
    switch (this.props.post.id) {
      case TitleId: what = 'Title'; break;
      case BodyPostId: what = 'Page'; break;
      default: what = 'Comment #' + this.props.post.id; break;
    }
    var text;
    switch (this.state.status) {
      case 'New': text = 'New ' + what; break; // COULD to lowercase
      case 'NewPrelApproved': text = 'New '+ what +', preliminarily approved'; break; // COULD lowercase
      case 'Approved': text = what; break;
      case 'Rejected': text = what +', rejected'; break;
      case 'Deleted': text = what +', deleted'; break;
      case 'Hidden': text = what +', hidden'; break;
      case 'EditsRejected': text = what +', edits rejected'; break;
      case 'NewEdits': text = what +', edited'; break;
      case 'EditsPrelApproved': text = what +', edits prel. approved'; break;
      default: text = what +', '+ this.state.status; break;
    }
    return text;
  },

  textOrDiffSafeHtml: function() {
    if (this.textOrDiffSafeHtmlCached)
      return this.textOrDiffSafeHtmlCached;

    var post = this.props.post;
    var result;
    var text = post.unapprovedText;
    if (text === undefined || text === null) {  // but not for ''
      text = post.approvedText;
    }
    switch (this.state.status) {
      case 'New':
        result = escapeHtml(text);
        break;
      case 'NewPrelApproved':
      case 'EditsPrelApproved':
      case 'Approved':
        result = escapeHtml(post.approvedText);
        break;
      case 'Rejected':
      case 'Deleted':
      case 'Hidden':
        result = escapeHtml(text);
        break;
      case 'EditsRejected':
      //case 'EditsPrelApproved': -- no, then approvedText = after the edits
      case 'NewEdits':
        result = debiki.internal.makeHtmlDiff(post.approvedText, post.unapprovedText);
        break;
      default:
        debiki.v0.util.die('DwE38RUJ0');
    }
    this.textOrDiffSafeHtmlCached = result;
    return result;
  },

  approve: function() {
    this.doSomething(Server.approvePost, 'Approved.');
  },

  deletePost: function() {
    this.doSomething(Server.deletePost, 'Deleted.');
  },

  rejectEdits: function() {
    this.doSomething(Server.rejectEdits, 'Edits rejected.', () => {
      this.setState({
        status: 'EditsRejected',
        approveBtnText: null,
        hideRejectEditsBtn: true,
      });
    });
  },

  deleteFlagged: function() {
    this.doSomething(Server.deleteFlaggedPost, 'Deleted.', this.clearFlagsState);
  },

  clearFlags: function() {
    this.doSomething(Server.clearFlags, 'Flags cleared.', this.clearFlagsState);
  },

  clearFlagsState: function() {
    this.setState({
      numHandledFlags: this.state.numHandledFlags + this.state.numPendingFlags,
      numPendingFlags: 0,
      pendingFlags: [],
    });
  },

  doSomething: function(serverFn: (_: string, any) => void, doneMessage,
        doneCallback?: () => void) {
    this.setState({
      approveBtnText: '',
      hideDeleteBtn: true,
      hideViewSuggsLink: true,
      hideRejectEditsBtn: true,
      inlineMessage: 'Wait...',
    });
    serverFn.call(Server, this.props.post, () => {
      this.setState({ inlineMessage: doneMessage });
      if (doneCallback) {
        doneCallback();
      }
    });
  },

  render: function() {
    var state = this.state;
    var post: PostToModerate = this.props.post;

    var oldFlagsCount = state.numHandledFlags
        ? r.a({ className: 'inline-action old-flags-link' },
                state.numHandledFlags + ' old flags')
        : null;

    var editSuggestions = post.numPendingEditSuggestions
        ? r.a({ className: 'inline-action suggestions-link' },
                post.numPendingEditSuggestions + ' edit suggestions')
        : null;

    var approveBtn = state.approveBtnText
        ? Button({ className: 'approve-new-post', onClick: this.approve }, state.approveBtnText)
        : null;
    // var hideAndSendPmBtn = ...
    var deleteBtn = state.hideDeleteBtn
        ? null
        : Button({ className: 'delete-new-post', onClick: this.deletePost }, 'Delete');
    var rejectBtn = state.hideRejectEditsBtn
        ? null
        : Button({ className: 'reject-edits', onClick: this.rejectEdits }, 'Reject edits');
    var approvalActions =
      r.div({ className: 'approval-actions' }, approveBtn, deleteBtn, rejectBtn);

    var flagsAndFlagActions;
    if (state.pendingFlags && state.pendingFlags.length) {
      var flags = state.pendingFlags.map((flag: Flag) => {  /// ?? zz WHY dupl flags ?? 
        return (
          r.li({ key: flag.flaggerId },
              'Type: ' + flag.flagType + ', reason: ' + flag.flagReason + ', by: ',
              r.a({ href: '/-/users/' + flag.flaggerId }, flag.flaggerDisplayName)));
      });

      flagsAndFlagActions =
        r.div({ className: 'flags' },
          r.div({ className: 'flags-header' }, state.numPendingFlags + ' new flags:'),
          r.ol({}, flags),
          r.div({ className: 'flag-actions' },
            // Button({}, 'Hide post + send PM') show if-not hideFlaggedSendPm,
            Button({ className: 'delete-flagged-post', onClick: this.deleteFlagged }, 'Delete post'),
            Button({ className: 'clear-flags', onClick: this.clearFlags }, 'Clear flags')));
    }

    var inlineMessage = this.state.inlineMessage
        ? r.span({ className: 'inline-message' }, this.state.inlineMessage)
        : null;

    return (
      r.tr({},
        r.td({ className: 'action-what' },
          r.div({},
            r.a({ className: 'action-description', href: this.url() }, this.description()),
            oldFlagsCount,
            editSuggestions),

          r.span({ className: 'action-path' }, post.pageName),

          approvalActions,
          flagsAndFlagActions,
          inlineMessage),

        r.td({},
          r.a({ href: '/-/users/' + post.userId }, post.userDisplayName)),

        r.td({ title: post.cdati }, moment(post.cdati).from(this.props.now)),

        r.td({ className: 'post-text',
          dangerouslySetInnerHTML: { __html: this.textOrDiffSafeHtml() }})));
  }
});



// COULD move to some debiki-common.js or debiki-utils.js?
function escapeHtml(html: string) {
  // See https://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat, rule #1.
  // However, & < > should be enough, see: org.owasp.encoder.Encode.forHtmlContent().
  return html
   .replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;");
}
 */

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
