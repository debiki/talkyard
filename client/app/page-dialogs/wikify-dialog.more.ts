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

//------------------------------------------------------------------------------
   module debiki2.pagedialogs {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);


var wikifyDialog;

export function openWikifyDialog(post: Post) {
  if (!wikifyDialog) {
    wikifyDialog = ReactDOM.render(WikifyDialog(), utils.makeMountNode());
  }
  wikifyDialog.open(post);
}


var WikifyDialog = createComponent({
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

  changeToStaffWiki: function() {
    ReactActions.changePostType(this.state.post, PostType.StaffWiki, this.close);
  },

  changeToCommunityWiki: function() {
    ReactActions.changePostType(this.state.post, PostType.CommunityWiki, this.close);
  },

  changeBackToNormal: function() {
    ReactActions.changePostType(this.state.post, PostType.Normal, this.close);
  },

  render: function () {
    var title;
    var content;
    var post: Post = this.state.post;
    var isWiki = isWikiPost(post);
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (isWiki) {
      title = "Cancel Wiki status?";
      var whichPeople = post.postType === PostType.StaffWiki ? "staff" : "community";
      content =
        r.div({},
          r.p({}, "This post is a wiki editable by " + whichPeople +
              " members and the original author."),
          r.div({ className: 'dw-wikify-btns' },
            Button({ onClick: this.changeBackToNormal,
                help: "The original author's name will be shown again. Only he or she " +
                  "and staff will be able to edit it. The author will be credited " +
                  "with any like votes."}, "Change back to normal")));
    }
    else {
      title = "Change to Wiki?";
      content =
        r.div({},
          r.p({}, "Change this post to a Wiki post so many people can edit it? " +
            "Usually you do *not* want to do this, because then " +
            "the author of this post will no longer get any like votes for this post."),
          r.div({ className: 'dw-wikify-btns' },
            Button({ onClick: this.changeToStaffWiki,
                help: "All staff members will be able to edit this post." },
              "Change to Staff Wiki"),
            Button({ onClick: this.changeToCommunityWiki,
                help: "All community members will be able to edit this post, " +
                  "except for fairly new users and those who seem a bit risky " +
                  "(not yet implemented though). " +
                  "Guest users may not edit it." },
                "Change to Community Wiki")));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'dw-wikify-dialog' },
        ModalHeader({}, ModalTitle({}, title)),
        ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, 'Cancel'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
