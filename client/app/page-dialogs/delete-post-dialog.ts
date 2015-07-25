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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var ButtonInput = reactCreateFactory(ReactBootstrap.ButtonInput);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalTrigger = reactCreateFactory(ReactBootstrap.ModalTrigger);
var OverlayMixin = ReactBootstrap.OverlayMixin;


export var deletePostDialog;


export function createDeletePostDialog() {
  var elem = document.getElementById('dw-react-delete-post-dialog');
  if (elem) {
    deletePostDialog = React.render(DeletePostDialog(), elem);
  }
}


var DeletePostDialog = createComponent({
  mixins: [OverlayMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
      loggedInUser: debiki2.ReactStore.getUser()
    };
  },

  open: function(post: Post) {
    this.setState({ isOpen: true, post: post });
  },

  close: function() {
    this.setState({ isOpen: false, post: null });
  },

  render: function () {
    return null;
  },

  doDelete: function() {
    var repliesToo = $('#deleteRepliesTooInput').is(':checked');
    ReactActions.deletePost(this.state.post.postId, repliesToo, this.close);
  },

  renderOverlay: function () {
    if (!this.state.isOpen)
      return null;

    var title = "Delete " + yourOrThis + " post?";
    var post: Post = this.state.post;
    var yourOrThis = this.state.loggedInUser.userId === post.authorId ? "your" : "this";

    var content =
      r.div({},
        r.div({ className: 'dw-delete-btns' },
          Input({ type: 'Button', value: "Yes delete it", onClick: this.doDelete }),
          Input({ type: 'checkbox', label: "Delete replies too",
              id: 'deleteRepliesTooInput' })));  // cannot use 'ref:' because not in render()

    return (
      Modal({ title: title, onRequestHide: this.close, className: 'dw-delete-post-dialog' },
        r.div({ className: 'modal-body' }, content),
        r.div({ className: 'modal-footer' },
          Button({ onClick: this.close }, 'Cancel'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
