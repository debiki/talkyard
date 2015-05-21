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
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var OverlayMixin = ReactBootstrap.OverlayMixin;


export var aboutUserDialog;


export function createAboutUserDialog() {
  var aboutUserDialogElem = document.getElementById('dw-react-about-user-dialog');
  if (aboutUserDialogElem) {
    aboutUserDialog = React.render(AboutUserDialog(), aboutUserDialogElem);
  }
}


var AboutUserDialog = createComponent({
  mixins: [OverlayMixin],

  getInitialState: function () {
    return { isOpen: false, user: null, post: null };
  },

  open: function(post: Post) {
    this.setState({ isOpen: true, pots: post });
    this.loadUser(post.authorId);
  },

  close: function() {
    this.setState({ isOpen: false, user: null, post: null });
  },

  loadUser: function(userId: number) {
    Server.loadCompleteUser(userId, (user: CompleteUser) => {
      if (!this.isMounted()) return;
      this.setState({ user: user });
    });
  },

  submit: function() {
    Server.flagPost(this.state.postId, this.state.flagType, this.state.reason, () => {
      this.close();
      setTimeout(() => {
        alert("Thanks. You have reported it. Someone will review it and "+
          "perhaps delete it or remove parts of it.");
      }, 0);
    });
  },

  render: function () {
    return null;
  },

  renderOverlay: function () {
    if (!this.state.isOpen)
      return null;

    var user: CompleteUser = this.state.user;
    var content;
    if (!user) {
      content = r.p({}, 'Loading...');
    }
    else if (isGuest(user)) {
      content = AboutUser({ user: user });
    }
    else {
      content = AboutGuest({ guest: user });
    }

    return (
      Modal({ title: 'About User', onRequestHide: this.close },
        r.div({ className: 'modal-body' }, content),
        r.div({ className: 'modal-footer' }, Button({ onClick: this.close }, 'Close'))));
  }
});


var AboutUser = createComponent({
  render: function() {
    var user: CompleteUser = this.props.user;
    return (
      r.div({},
        'Username: ' + user.username, r.br(),
        'Name: ' + user.fullName));
  }
});


var AboutGuest = createComponent({
  render: function() {
    var guest: Guest = this.props.guest;
    return (
      r.div({},
        'Name: ' + guest.fullName + ' — is a guest user, could be anyone'));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
