/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="name-login-btns.ts" />

//------------------------------------------------------------------------------
   module debiki2.reactelements {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;


export var CommentsToolbar = React.createClass({
  getInitialState: function() {
    return debiki2.ReactStore.allData();
  },

  componentDidMount: function() {
    debiki2.ReactStore.addChangeListener(this.onChange);
  },

  componentWillUnmount: function() {
    debiki2.ReactStore.removeChangeListener(this.onChange);
  },

  onChange: function() {
    this.setState(debiki2.ReactStore.allData());
  },

  onReplyClick: function() {
    d.i.$showReplyForm(); // UNTESTED after porting to React
  },

  render: function() {
    var embeddedClass = '';
    var anyReplyBtnElem = null;
    if (this.state.isInEmbeddedCommentsIframe) {
      embeddedClass = ' dw-embedded';
      anyReplyBtnElem =
          r.button({ className: 'dw-a dw-a-reply icon-reply btn btn-default',
              styleName: 'float: none; margin: 0 15px 0 3px;', onClick: this.onReplyClick },
              'Reply');
    }

    var numPostsOrCommentsText = this.state.isInEmbeddedCommentsIframe
      ? this.state.numPostsExclTitle - 1 + ' comments' // don't count the article
      : this.state.numPostsExclTitle + ' posts'; // not -1, the original post is a post

    var elems =
        r.div({ className: 'dw-cmts-tlbr' + embeddedClass },
            r.span({ className: 'dw-cmts-count' }, numPostsOrCommentsText),
            NameLoginBtns());

    return elems;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
