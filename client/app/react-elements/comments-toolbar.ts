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
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);


export var CommentsToolbar = React.createClass({
  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      ui: { showDetails: false }
    };
  },

  componentDidMount: function() {
    debiki2.ReactStore.addChangeListener(this.onChange);
  },

  componentWillUnmount: function() {
    debiki2.ReactStore.removeChangeListener(this.onChange);
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
      ui: this.state.ui
    });
  },

  onReplyClick: function() {
    d.i.showReplyFormEmbeddedComments();
  },

  onToggleDetailsClick: function() {
    this.state.ui.showDetails = !this.state.ui.showDetails;
    this.setState(this.state);
  },

  render: function() {
    var store = this.state.store;
    var ui = this.state.ui;
    var user = store.user;
    var userAuthenticated = user && user.isAuthenticated;

    var embeddedClass = '';
    var anyReplyBtnElem = null;
    if (store.isInEmbeddedCommentsIframe) {
      embeddedClass = ' dw-embedded';
      anyReplyBtnElem =
          r.button({ className: 'dw-a dw-a-reply icon-reply btn btn-default',
              styleName: 'float: none; margin: 0 15px 0 3px;', onClick: this.onReplyClick },
              'Reply');
    }

    var notfLevelElem = userAuthenticated && !ui.showDetails
      ? r.span({ className: 'dw-page-notf-level', onClick: this.onToggleDetailsClick },
          'Notifications: ' + user.rolePageSettings.notfLevel)
      : null;

    var toggleDetailsBtn = userAuthenticated
      ? r.button({ className: 'dw-cmts-tlbr-open', onClick: this.onToggleDetailsClick },
          r.span({ className: (ui.showDetails ? 'icon-chevron-up' : 'icon-chevron-down') }))
      : null;

    var numPostsOrCommentsText = store.isInEmbeddedCommentsIframe
        ? store.numPostsExclTitle - 1 + ' comments' // don't count the article
        : store.numPostsExclTitle + ' posts'; // not -1, the original post is a post

    var summaryElem =
      r.div({ className: 'dw-cmts-tlbr-head' },
          anyReplyBtnElem,
          r.ul({ className: 'dw-cmts-tlbr-summary' },
              r.li({ className: 'dw-cmts-count' }, numPostsOrCommentsText),
              r.li({}, NameLoginBtns()),
              r.li({}, notfLevelElem)),
          toggleDetailsBtn);

    var detailsElem = ui.showDetails
      ? CommentsToolbarDetails(store)
      : null;

    var result =
      r.div({ className: 'dw-cmts-tlbr' + embeddedClass },
          summaryElem,
          detailsElem);

    return result;
  }
});


var CommentsToolbarDetails = React.createClass({
  onNewNotfLevel: function(newLevel) {
    ReactActions.setPageNoftLevel(newLevel);
  },

  render: function() {
    var user = this.props.user;
    var userAuthenticated = user && user.isAuthenticated;

    var notificationsElem = userAuthenticated
        ? DropdownButton({ title: user.rolePageSettings.notfLevel,
              className: 'dw-notf-level', onSelect: this.onNewNotfLevel },
            MenuItem({ eventKey: 'Watching' }, 'Watching'),
            MenuItem({ eventKey: 'Tracking' }, 'Tracking'),
            MenuItem({ eventKey: 'Regular' }, 'Regular'),
            MenuItem({ eventKey: 'Muted' }, 'Muted'))
        : null;

    var result =
      r.div({ className: 'dw-cmts-tlbr-details' },
          notificationsElem);

    return result;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
