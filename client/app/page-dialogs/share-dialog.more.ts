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

var r = React.DOM;
var DropdownModal = utils.DropdownModal;


var shareDialog;

export function openShareDialog(post: Post, button) {
  if (!shareDialog) {
    shareDialog = ReactDOM.render(ShareDialog(), utils.makeMountNode());
  }
  shareDialog.openForAt(post, button);
}


var Facebook = 'facebook';
var Twitter = 'twitter';
var Google = 'google-plus';
var Email = 'mail';

// some dupl code [6KUW24]
var ShareDialog = createComponent({
  displayName: 'ShareDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      post: null,
    };
  },

  // dupl code [6KUW24]
  openForAt: function(post: Post, at) {
    var rect = at.getBoundingClientRect();
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

  share: function(url, where) {
    var encodedUrl = encodeURIComponent(url);
    var urlToOpen;
    var windowSize;
    // These FB, Twitter, G+ share links works as of May 29, 2016.
    switch (where) {
      case Facebook:
        // There's also: &t=<title>
        urlToOpen = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
        windowSize = "width=600,height=400";
        break;
      case Twitter:
        // There's also: &via=<twitter-handle>&text=<title>
        urlToOpen = 'https://www.twitter.com/intent/tweet?url=' + encodedUrl;
        windowSize = "width=600,height=500";
        break;
      case Google:
        urlToOpen = 'https://plus.google.com/share?url=' + encodedUrl;
        windowSize = "width=550,height=550";
        break;
      case Email:
        window.open('mailto:?body=' +  encodedUrl);
        return;
      default:
        die('EsE6YKF32');
    }
    window.open(urlToOpen, '',
      'resizable=yes,scrollbars=yes,location=yes,menubar=no,toolbar=no,status=no,' + windowSize);
  },

  render: function() {
    var state = this.state;
    var content;
    if (state.isOpen) {
      var post: Post = state.post;
      var origin = location.protocol + '//' + location.host;
      var url = origin + '/-' + debiki.getPageId() + '#post-' + post.postId;
      var makeShareButton = (where: string) => {
        return (
          r.a({ className: 'esShare_social_icon icon-' + where,
              onClick: () => this.share(url, where) }));
      };
      content =
        r.div({ className: 'esShare' },
          r.div({ className: 'esShare_title' },
            "Copy a link to this post, or click a share button:"),
          r.input({ className: 'esShare_link', value: url, ref: 'linkInput', readOnly: true }),
          r.div({ className: 'esShare_social' },
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
