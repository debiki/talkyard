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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


let deletePostDialog;

export function openDeletePostDialog(ps: { post: Post, at: Rect, doAsAnon?: MaybeAnon }) {
  if (!deletePostDialog) {
    deletePostDialog = ReactDOM.render(DeletePostDialog(), utils.makeMountNode());
  }
  deletePostDialog.open(ps);
}


const DeletePostDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
      loggedInUser: debiki2.ReactStore.getMe()
    };
  },

  open: function(ps: { post: Post, at: Rect, doAsAnon?: MaybeAnon }) {
    this.setState({
      isOpen: true,
      post: ps.post,
      atRect: ps.at,
      doAsAnon: ps.doAsAnon,
      windowWidth: window.innerWidth,
    });
  },

  close: function() {
    this.setState({ isOpen: false, post: null });
  },

  doDelete: function() {
    ReactActions.deletePost(this.state.post.nr, this._delRepls, this.state.doAsAnon, this.close);
  },

  render: function () {
    let title;
    let content;
    if (this.state.isOpen) {
      const me: Myself = this.state.loggedInUser;
      const post: Post = this.state.post;
      const isMyPost = me.id === post.authorId;
      const yourOrThis = isMyPost ? "your" : "this";
      title = "Delete " + yourOrThis + " post?";
      content = !isStaff(me) ? null :   // UX BUG hide if is chat? then no replies?
        r.div({ className: 'dw-delete-btns' },
          isStaff(me)
              ? Input({ type: 'checkbox', label: "Delete replies too",
                    onChange: (event) => this._delRepls = event.target.checked })
              : null);
    }
    return (
      utils.DropdownModal({ show: this.state.isOpen, onHide: this.close, showCloseButton: true,
          className: 'dw-delete-post-dialog',
          atRect: this.state.atRect, windowWidth: this.state.windowWidth },
        ModalHeader({}, ModalTitle({}, title)),
        content ? ModalBody({}, content) : null,
        ModalFooter({},
          Button({ onClick: this.doDelete, bsStyle: 'primary', className: 'e_YesDel' }, "Yes delete it"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
