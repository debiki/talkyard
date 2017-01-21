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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


var deletePostDialog;

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
    var repliesToo = $('#deleteRepliesTooInput').is(':checked');
    ReactActions.deletePost(this.state.post.nr, repliesToo, this.close);
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
                    id: 'deleteRepliesTooInput' }) // cannot use 'ref:' because not in render()
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
