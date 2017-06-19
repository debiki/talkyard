/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = React.DOM;
const DropdownModal = utils.DropdownModal;


let shareDialog;

export function openShareDialog(post: Post, button) {
  if (!shareDialog) {
    shareDialog = ReactDOM.render(ShareDialog(), utils.makeMountNode());
  }
  shareDialog.openForAt(post, button);
}


// some dupl code [6KUW24]
const ShareDialog = createComponent({
  displayName: 'ShareDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
    };
  },

  // dupl code [6KUW24]
  openForAt: function(post: Post, at) {
    const rect = at.getBoundingClientRect();
    this.setState({
      isOpen: true,
      atX: rect.left - 140,
      atY: rect.bottom - 60,
      post: post,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onComponentDidUpdate: function() {
    if (this.refs.linkInput) {
      this.refs.linkInput.select();
    }
  },

  render: function() {
    const state = this.state;
    let content;
    if (state.isOpen) {
      const post: Post = state.post;
      const origin = location.protocol + '//' + location.host;
      const url = origin + '/-' + debiki.getPageId() + '#post-' + post.nr;
      const makeShareButton = (where: string) => {  // dupl code [2WUGVSF0]
        return (
          r.a({ className: 'p_ShareIcon icon-' + where,
              onClick: () => openSharePopup(url, where) }));
      };
      content =
        r.div({ className: 's_ShareD' },
          r.div({ className: 's_ShareD_Title' },
            "Copy a link to this post, or click a share button:"),
          r.input({ className: 's_ShareD_Link', value: url, ref: 'linkInput', readOnly: true }),
          r.div({ className: 's_ShareD_Social' },
            makeShareButton(Facebook),
            makeShareButton(Twitter),
            makeShareButton(Google),
            makeShareButton(Email)));
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true, showCloseButton: true },
       content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
