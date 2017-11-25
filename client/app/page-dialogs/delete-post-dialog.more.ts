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
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


let deletePostDialog;

export function openDeletePostDialog(post: Post) {
  if (!deletePostDialog) {
    deletePostDialog = ReactDOM.render(DeletePostDialog(), utils.makeMountNode());
  }
  deletePostDialog.open(post);
}


var DeletePostDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
      loggedInUser: debiki2.ReactStore.getMe()
    };
  },

  open: function(post: Post) {
    this.setState({ isOpen: true, post: post });
  },

  close: function() {
    this.setState({ isOpen: false, post: null });
  },

  doDelete: function() {
    ReactActions.deletePost(this.state.post.nr, this._delRepls, this.close);
  },

  render: function () {
    var title;
    var content;
    if (this.state.isOpen) {
      var me: Myself = this.state.loggedInUser;
      var post: Post = this.state.post;
      var isMyPost = me.id === post.authorId;
      var yourOrThis = isMyPost ? "your" : "this";
      title = "Delete " + yourOrThis + " post?";
      content = !isStaff(me) ? null :
        r.div({ className: 'dw-delete-btns' },
          isStaff(me)
              ? Input({ type: 'checkbox', label: "Delete replies too",
                    onChange: (event) => this._delRepls = event.target.checked })
              : null);
    }
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'dw-delete-post-dialog' },
        ModalHeader({}, ModalTitle({}, title)),
        content ? ModalBody({}, content) : null,
        ModalFooter({},
          Button({ onClick: this.doDelete, bsStyle: 'primary' }, "Yes delete it"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
