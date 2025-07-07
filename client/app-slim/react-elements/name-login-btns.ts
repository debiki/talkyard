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
    login.loginIfNeededReturnToAnchor(this.props.purpose || LoginReason.LoginToLogin,
        // Wouldo it be nice to, if in embedded comments, scroll down to the comments
        // section after login?  [scroll_to_emb_comts]
        '');
  },

  onLogoutClick: function() {
    debiki2.ReactActions.logout();
  },

  render: function() {
    const store: Store = this.state.store;
    const me: Myself = store.me;

    const settings: SettingsVisibleClientSide = store.settings;

    let showAuthnBtns = true;  /*  [hide_authn_btns]
    // Rethink this later. Need to store session type inside session string?
    if (settings.enableSso) {
      if (me.isLoggedIn) {
        if (settings.ssoLogoutRedirUrl &&
                  settings.ssoShowEmbAuthnBtns !== ShowEmbAuthnBtnsBitf.None) {
          // Show logout button.
        }
        else {
          // If auto logged in via token in embedding html, then auto log out,
          // if it's not there any longer.
    ———>  // But! accessing another frame from here maybe is bad for perforamnce?
          // (getMainWin() might be another iframe, if embedded comments)
          const sessType = getMainWin().typs.sessType;
          if (sessType === SessionType.AutoTokenSiteCustomSso) {
            showAuthnBtns = false;
          }
          else {
            // Leave showAuthnBtns = true — apparently we got logged in in
            // some other way, maybe just before an admin cahnged the settings.
          }
        }
      }
      else {
        showAuthnBtns = settings.ssoShowEmbAuthnBtns !== ShowEmbAuthnBtnsBitf.None;
      }
    }
    */

    let userNameElem = null;
    let logoutBtnElem = null;
    const target = store.isEmbedded ? '_blank' : undefined;
    if (me.isLoggedIn) {
      userNameElem =
          r.span({ className: 'dw-u-info' },
            t.LoggedInAs,
            LinkUnstyled({ className: 's_MB_Name', to: linkToUserProfilePage(me), target },
              !me.fullName ? null : r.span({ className: 'esP_By_F' }, me.fullName + ' '),
              !me.username ? null : r.span({ className: 'esP_By_U' }, '@' + me.username)));
      logoutBtnElem = !showAuthnBtns ? null :
          r.span({ className: 'dw-a-logout', onClick: this.onLogoutClick, id: this.props.id },
            t.LogOut);
    }

    let loginBtnElem = null;
    if (!me.isLoggedIn && showAuthnBtns) {
      const disabled = this.props.disabled ? 'disabled' : '';
      loginBtnElem =
          r.span({ className: 'dw-a-login btn btn-primary ' + disabled,
              onClick: disabled ? null : this.onLoginClick, id: this.props.id },
            this.props.title || t.LogIn);
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
