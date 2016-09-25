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
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../page-dialogs/about-user-dialog.more.ts" />

//------------------------------------------------------------------------------
  module debiki2.edithistory {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);

var editHistoryDialog;


export function getEditHistoryDialog() {
  if (!editHistoryDialog) {
    editHistoryDialog = ReactDOM.render(EditHistoryDialog(), utils.makeMountNode());
  }
  return editHistoryDialog;
}


var EditHistoryDialog = createClassAndFactory({
  getInitialState: function() {
    return {
      isOpen: false,
      isLoading: false,
      postId: null,
      revisionsRecentFirst: null,
    };
  },

  open: function(postId: number) {
    this.setState({
      isOpen: true,
      isLoading: true,
      postId: postId,
      revisionsRecentFirst: null,
    });
    utils.loadDiffMatchPatch(() => {
      if (!this.isMounted()) return;
      // (Reload revisions, even if we've loaded them already — perhaps the post was just edited.)
      Server.loadLatestPostRevisions(postId, (revisions) => {
        if (!this.isMounted()) return;
        this.setState({
          isLoading: false,
          revisionsRecentFirst: revisions,
        });
      });
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  loadMoreRevisions: function() {
    var oldestRevisionLoaded: any = _.last(this.state.revisionsRecentFirst);
    dieIf(!oldestRevisionLoaded, 'EdE8FMIW2');
    dieIf(oldestRevisionLoaded.revisionNr === 1, 'EdE4MW20');
    this.setState({ isLoadingMore: true });
    Server.loadMorePostRevisions(this.state.postId, oldestRevisionLoaded.revisionNr - 1,
        (moreRevisions) => {
      if (!this.isMounted()) return;
      var revisions = this.state.revisionsRecentFirst.concat(moreRevisions);
      this.setState({
        revisionsRecentFirst: revisions,
        isLoadingMore: false
      });
    });
  },

  render: function () {
    var body;
    var revisionsRecentFirst = this.state.revisionsRecentFirst;
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (this.state.isLoading) {
      body = r.p({}, "Loading...");
    }
    else if (revisionsRecentFirst.length <= 1) {
      // (COULD tell if the post has been ninja edited?)
      body = r.p({}, "No revisions saved. Nothing here to see.");
    }
    else {
      var revisionElems = [];
      for (var i = 0; i < revisionsRecentFirst.length - 1; ++i) {
        var thisRevision = revisionsRecentFirst[i];
        var prevRevision = revisionsRecentFirst[i + 1];
        revisionElems.push(
            PostRevisionRow({ isCurrent: i === 0, key: thisRevision.revisionNr,
                thisRevision: thisRevision, prevRevision: prevRevision }));
        if (i === revisionsRecentFirst.length - 2) {
          // Are there more revisions server side? Then add a load-more button.
          if (prevRevision.revisionNr > 1) {
            revisionElems.push(
                Button({ onClick: this.loadMoreRevisions, className: 'ed-load-more-revs',
                    disabled: this.state.isLoadingMore, key: 'LoadMoreBtn' },
                  this.state.isLoadingMore ? "Loading more revisions..." : "Load more"));
          }
        }
      }
      body = r.div({},
        help.HelpMessageBox({ message: diffHelpMessage }),
        revisionElems);
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
    var composedBy = UserNameLink({ user: thisRevision.composedBy });
    var anyApprovedBy;
    /* Later: if approved by someone else (and not the system user), and if is staff, then:
      anyApprovedBy = r.span({}, " and approved by", UserNameLink({ user: revision.approvedBy }));
    */
    var revisionNrText = this.props.isCurrent ?
      "Latest changes" : "Changes in revision " + thisRevision.revisionNr;
      // BUG latest changes timestamp = wrong, too old (start of cur rev, not end?)
    return r.div({ className: 'ed-revision' },
      r.p({}, revisionNrText + ", composed by ", composedBy,
          ' ' + moment(thisRevision.composedAtMs).fromNow(), anyApprovedBy, ':'),
      r.pre({ dangerouslySetInnerHTML: { __html: htmlDiff }}));
  }
});


var diffHelpMessage = {
  id: 'EdH5UYFM2',
  version: 1,
  content: r.p({},
      "Here you can see how people have edited this post. ",
      r.ins({}, "Text in bold green"), " was added, and ",
      r.del({}, "overstriked text in red"), " was deleted. " +
      "Scroll down to see all edits, if there are many."),
};


// COULD move to some utils class? Some dupl code, see posts.ts [88MYU2]
var UserNameLink = createComponent({
  onClick: function(event) {
    pagedialogs.getAboutUserDialog().openForUser(this.props.user);
    event.preventDefault();
    event.stopPropagation();
  },

  render: function() {
    var user: BriefUser = this.props.user;
    var username = user.username;
    var fullName = user.fullName;
    var namePart1;
    var namePart2;
    if (fullName && username) {
      namePart1 = r.span({ className: 'dw-username' }, username);
      namePart2 = r.span({ className: 'dw-fullname' }, ' (' + fullName + ')');
    }
    else if (fullName) {
      namePart1 = r.span({ className: 'dw-fullname' }, fullName);
      var questionMarks = user.isEmailUnknown ? "??" : "?";
      namePart2 = r.span({ className: 'dw-lg-t-spl' }, questionMarks);
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
