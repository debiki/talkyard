/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
/// <reference path="../utils/PatternInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var PatternInput = utils.PatternInput;

var movePostsDialog;


export function openMovePostsDialog(store: Store, post: Post, closeCaller) {
  if (!movePostsDialog) {
    movePostsDialog = ReactDOM.render(MovePostsDialog(), utils.makeMountNode());
  }
  movePostsDialog.open(store, post, closeCaller);
}


var MovePostsDialog = createComponent({
  getInitialState: function () {
    return {};
  },

  open: function(store: Store, post: Post, closeCaller) {
    this.setState({
      isOpen: true,
      store: store,
      post: post,
      newParentUrl: '',
      closeCaller: closeCaller,
    });
  },

  close: function() {
    this.setState({ isOpen: false, store: null, post: null });
  },

  doMove: function() {
    Server.movePost(this.state.post.uniqueId, this.state.newHost, this.state.newPageId,
        this.state.newParentNr, (postAfter: Post) => {
      if (this.state.store.pageId === this.state.newPageId) {
        // Within the same page, then scroll to the new location.
        // COULD add Back entry, which navigates back to the former parent or any
        // sibling just above.
        debiki.internal.showAndHighlightPost($('#post-' + postAfter.postId));
      }
      else {
        // Let the user decide him/herself if s/he wants to open a new page.
        var newPostUrl = '/-' + this.state.newPageId + '#post-' + postAfter.postId;
        util.openDefaultStupidDialog({
          body: r.div({},
            "Moved. ", r.a({ href: newPostUrl }, "Click here to view it."))
        });
      }
      if (this.state.closeCaller) this.state.closeCaller();
      this.close();
    });
  },

  previewNewParent: function() {
    window.open(this.state.newParentUrl);
  },

  render: function () {
    var content = r.div({},
      r.p({}, "Move post to where? Specify a new parent post, can be on a different page."),
      PatternInput({ type: 'text', label: "URL to new parent post:",
        help: r.span({}, "Tips: Click the ", r.span({ className: 'icon-link' }), " link " +
          "below the destination post, to copy its URL"),
        onChangeValueOk: (value, ok) => {
          var matches = value.match(/((https?:\/\/)?([^/]+))?\/-([a-zA-Z0-9_]+)#post-([0-9]+)$/);
          if (!matches) {
            this.setState({ ok: false });
            return;
          }
          this.setState({
            newParentUrl: value,
            newHost: matches[3],
            newPageId: matches[4],
            newParentNr: parseInt(matches[5]),
            ok: ok
          });
        },
        regex: /^((https?:\/\/)?[^/]+)?\/-[a-zA-Z0-9_]+#post-[0-9]+/,
        message: "Invalid new parent post link, should be like: " + location.hostname +
            "/-[page_id]/#post-[post_nr]" }),
      PrimaryButton({ onClick: this.doMove, disabled: !this.state.ok }, "Move"),
      Button({ onClick: this.previewNewParent }, "Preview"));

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Move post")),
        ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
