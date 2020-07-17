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

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
var Modal = rb.Modal;
var ModalHeader = rb.ModalHeader;
var ModalTitle = rb.ModalTitle;
var ModalBody = rb.ModalBody;
var ModalFooter = rb.ModalFooter;


let wikifyDialog;

export function openWikifyDialog(post: Post) {
  if (!wikifyDialog) {
    wikifyDialog = ReactDOM.render(WikifyDialog(), utils.makeMountNode());
  }
  wikifyDialog.open(post);
}


const WikifyDialog = createComponent({
  displayName: 'WikifyDialog',

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

  changeToCommunityWiki: function() {
    ReactActions.changePostType(this.state.post, PostType.CommunityWiki, this.close);
  },

  changeBackToNormal: function() {
    ReactActions.changePostType(this.state.post, PostType.Normal, this.close);
  },

  render: function () {
    let title;
    let content;
    const post: Post = this.state.post;
    const isWiki = isWikiPost(post);
    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (isWiki) {
      title = "Cancel Wiki status?";  // I18N
      const whichPeople = post.postType === PostType.StaffWiki ? "staff" : "community";
      content =
        r.div({},
          r.p({}, "This post is a wiki. Others can edit it."),   // I18N
          r.div({ className: 'dw-wikify-btns' },
            Button({ onClick: this.changeBackToNormal, className: 'e_UnWk',
                help: "Will show the original author's name again, " +  // I18N
                      "and prevent others from editing it (except for staff)."},
                  "Change back to normal")));
    }
    else {
      title = "Change to Wiki?";  // I18N
      content =
        r.div({},
          r.p({},
              "Then, others can edit it."  // I18N
            /* excl this — too much text to read, and maybe Like votes aren't so important.
            "(The post author will then get no credits for Like votes, for this post.)" */),
          r.div({ className: 'dw-wikify-btns' },
            Button({ onClick: this.changeToCommunityWiki, className: 'e_MkWk' },
                "Yes, make Wiki")));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'dw-wikify-dialog' },
        ModalHeader({}, ModalTitle({}, title)),
        ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, t.Cancel))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
