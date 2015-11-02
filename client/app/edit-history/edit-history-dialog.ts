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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />

//------------------------------------------------------------------------------
  module debiki2.edithistory {
//------------------------------------------------------------------------------


var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);

var editHistoryDialog;


export function getEditHistoryDialog() {
  if (!editHistoryDialog) {
    editHistoryDialog = React.render(EditHistoryDialog(), utils.makeMountNode());
  }
  return editHistoryDialog;
}


var EditHistoryDialog = createClassAndFactory({
  getInitialState: function() {
    return {
      isOpen: false,
      isLoading: false,
      postId: null,
      revisions: null,
    };
  },

  open: function(postId: number) {
    this.setState({ isOpen: true, isLoading: true });
    utils.loadDiffMatchPatch(() => {
      if (!this.isMounted()) return;
      if (this.state.postId === postId && this.state.revisionsRecentFirst) {
        this.setState({ isLoading: false });
        return;
      }

      this.setState({ isLoading: true });
      Server.loadLatestPostRevisions(postId, (revisions) => {
        if (!this.isMounted()) return;
        this.setState({ isLoading: false, revisionsRecentFirst: revisions });
      });
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  render: function () {
    var body;
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (this.state.isLoading) {
      body = r.p({}, "Loading...");
    }
    else if (this.state.revisionsRecentFirst.length <= 1) {
      // (COULD tell if the post has been ninja edited?)
      body = r.p({}, "No revisions saved. Nothing here to see.");
    }
    else {
      body = [];
      for (var i = 0; i < this.state.revisionsRecentFirst.length - 1; ++i) {
        var thisRevision = this.state.revisionsRecentFirst[i];
        var prevRevision = this.state.revisionsRecentFirst[i + 1];
        body.push(
            PostRevisionRow({ isCurrent: i === 0, thisRevision: thisRevision,
                prevRevision: prevRevision }));
      };
    }
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, bsSize: 'large',
          dialogClassName: 'dw-edit-history' },
        ModalHeader({}, ModalTitle({}, "History")),
        ModalBody({}, body),
        ModalFooter({}, Button({ onClick: this.close }, "Close"))));
  }
});


var PostRevisionRow = createComponent({
  render: function() {
    var thisRevision: PostRevision = this.props.thisRevision;
    var prevRevision: PostRevision = this.props.prevRevision;
    var htmlDiff = utils.makeHtmlDiff(prevRevision.fullSource, thisRevision.fullSource);
    var userLink = UserNameLink({ postRevision: thisRevision });
    var revisionNrText = this.props.isCurrent ?
      "Latest changes" : "Changes in revision " + thisRevision.revisionNr;
    return r.div({ className: 'ed-revision' },
      r.p({}, revisionNrText + ", composed by ", userLink, ':'),
      r.pre({ dangerouslySetInnerHTML: { __html: htmlDiff }}));
  }
});


// COULD move to some utils class? Some dupl code, see posts.ts [88MYU2]
var UserNameLink = createComponent({
  getInitialState: function() {
    var data = this.props.post || this.props.user || this.props.postRevision;
    return {
      postUniqueId: (this.props.post || {}).uniqueId,
      userId: data.authorId || data.userId || data.composedById,
      username: data.authorUsername || data.username || data.composedByUsername,
      fullName: data.authorFullName || data.fullName || data.composedByFullName,
    };
  },

  onClick: function(event) {
    pagedialogs.getAboutUserDialog().open(this.state.userId);
    event.preventDefault();
    event.stopPropagation();
  },

  render: function() {
    var userId: number = this.state.userId;
    var username: string = this.state.username;
    var fullName: string = this.state.fullName;
    var namePart1;
    var namePart2;
    if (fullName && username) {
      namePart1 = r.span({ className: 'dw-username' }, username);
      namePart2 = r.span({ className: 'dw-fullname' }, ' (' + fullName + ')');
    }
    else if (fullName) {
      namePart1 = r.span({ className: 'dw-fullname' }, fullName);
      namePart2 =
          r.span({ className: 'dw-lg-t-spl' }, '?'); // {if (user.email isEmpty) "??" else "?"
    }
    else if (username) {
      namePart1 = r.span({ className: 'dw-username' }, username);
    }
    else {
      namePart1 = r.span({}, '(unknown)');
    }
    return (
      r.a({ className: 'dw-p-by', onClick: this.props.abbreviate ? null : this.onClick },
        namePart1, namePart2));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
