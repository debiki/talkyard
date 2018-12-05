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

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
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
      copied: undefined,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onComponentDidUpdate: function() {
    this.selectTryCopy(false);
  },

  selectTryCopy: function(copy) {
    if (this.refs.linkInput) {
      this.refs.linkInput.focus();
      this.refs.linkInput.select();
      if (copy !== false) {
        try {
          const result= document.execCommand('copy');
          if (result) this.setState({ copied: true });
        }
        catch (ex) {
          // ignore
        }
      }
    }
  },

  render: function() {
    const state = this.state;
    let content;
    if (state.isOpen) {
      const post: Post = state.post;

      let url: string;
      const embeddingUrl = eds.embeddingUrl;
      if (embeddingUrl) {
        // Use '#comment-NNN' hashes for embedded comments, since they are often for blog   [2PAWC0]
        // posts and might be confusing with urls like: http://blog/post/123#post-456
        // this is better: http://blog/post/123#comment-456.
        // Subtract 1 to get the comment nr — the firs reply is post 2, but comment 1.  [2PAWC0]
        // (The orig post has post nr 1.)
        const hash = post.nr >= FirstReplyNr ? '#comment-' + (post.nr - 1) : '';
        url = embeddingUrl.split('#')[0] + hash;
      }
      else {
        const origin = location.protocol + '//' + location.host;
        const hash = post.nr >= FirstReplyNr ? '#post-' + post.nr : '';
        url = origin + '/-' + ReactStore.getPageId() + hash;
      }
      const makeShareButton = (where: string) => {  // dupl code [2WUGVSF0]
        return (
          r.a({ className: 'p_ShareIcon icon-' + where,
              onClick: () => openSharePopup(url, where) }));
      };
      content =
        r.div({ className: 's_ShareD' },
          r.div({ className: 's_ShareD_Title' },
            this.state.copied ? t.sd.Copied : (
              this.state.copied === false ? t.sd.CtrlCToCopy : // UX What to say, if is mobile?
                  t.sd.ClickToCopy)),
          r.input({ className: 's_ShareD_Link', value: url, ref: 'linkInput', readOnly: true,
              onClick: this.selectTryCopy }),
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
