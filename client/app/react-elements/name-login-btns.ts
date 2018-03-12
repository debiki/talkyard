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

/// <reference path="../ReactStore.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.reactelements {
//------------------------------------------------------------------------------


export const NameLoginBtns = createComponent({
  displayName: 'NameLoginBtns',

  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return { store: debiki2.ReactStore.allData() };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  onChange: function() {
    if (this.isGone) {
      // Don't know how this can happen, but it does inside the NonExistingPage component.
      return;
    }
    this.setState({ store: debiki2.ReactStore.allData() });
  },

  onLoginClick: function() {
    morebundle.openLoginDialog(this.props.purpose || 'LoginToLogin');
  },

  onLogoutClick: function() {
    debiki2.ReactActions.logout();
  },

  render: function() {
    const store: Store = this.state.store;
    const me: Myself = store.me;

    let userNameElem = null;
    let logoutBtnElem = null;
    const target = eds.isInEmbeddedCommentsIframe ? '_blank' : undefined;
    if (me.isLoggedIn) {
      userNameElem =
          r.span({ className: 'dw-u-info' },
            t.LoggedInAs,
            r.a({ className: 's_MB_Name', href: linkToUserProfilePage(me.username), target },
              r.span({ className: 'esP_By_F' }, me.fullName ? me.fullName + ' ' : ''),
              r.span({ className: 'esP_By_U' }, '@' + me.username)));
      logoutBtnElem =
          r.span({ className: 'dw-a-logout', onClick: this.onLogoutClick, id: this.props.id },
            t.LogOut);
    }

    let loginBtnElem = null;
    if (!me.isLoggedIn) {
      const disabled = this.props.disabled ? 'disabled' : '';
      loginBtnElem =
          r.span({ className: 'dw-a-login btn btn-primary ' + disabled,
              onClick: disabled ? null : this.onLoginClick, id: this.props.id },
            this.props.title || t.Login);
    }

    return (
      r.span({ className: 'dw-u-lgi-lgo' },
        userNameElem,
        loginBtnElem,
        logoutBtnElem));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
