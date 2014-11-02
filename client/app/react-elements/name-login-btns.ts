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

//------------------------------------------------------------------------------
   module debiki2.reactelements {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;


export var NameLoginBtns = React.createClass({
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

  onLoginClick: function() {
    d.i.showLoginDialog('LoginToLogin');
  },

  onLogoutClick: function() {
    d.u.postJson({ url: d.i.serverOrigin + '/-/logout' })
      .fail(d.i.showServerResponseDialog)
      .done(d.i.Me.fireLogout);
  },

  render: function() {
    var userNameElem = null;
    if (this.state.user) {
      userNameElem =
          r.span({ className: 'dw-u-info' },
              r.span({ className: 'dw-u-name' }, this.state.user.fullName));
    }

    var buttonsNotLinks = this.state.isInEmbeddedCommentsIframe;

    var loginBtnElem = null;
    if (!this.state.user) {
      loginBtnElem = buttonsNotLinks
          ? r.button({ className: 'dw-a-login btn btn-default', onClick: this.onLoginClick },
              'Login')
          : r.span({ className: 'dw-a-login', onClick: this.onLoginClick }, 'Login');
    }

    var logoutBtnElem = null;
    if (this.state.user) {
      logoutBtnElem = buttonsNotLinks
          ? r.button({ className: 'dw-a-logout btn btn-default',
              onClick: this.onLogoutClick }, 'Logout')
          : r.span({ className: 'dw-a-logout', onClick: this.onLogoutClick }, 'Logout');
    }

    var elems =
      r.span({ className: 'dw-u-lgi-lgo' },
        userNameElem,
        loginBtnElem,
        logoutBtnElem);

    return elems;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
