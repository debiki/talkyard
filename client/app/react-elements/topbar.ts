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
/// <reference path="../ReactStore.ts" />
/// <reference path="name-login-btns.ts" />
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.reactelements {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);


export var TopBar = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      showSearchForm: false,
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData()
    });
  },

  onLoginClick: function() {
    // COULD call new fn ReactActions.login() instead?
    d.i.showLoginDialog(this.props.purpose || 'LoginToLogin');
  },

  onLogoutClick: function() {
    // COULD call new fn ReactActions.logout() instead?
    d.u.postJson({ url: d.i.serverOrigin + '/-/logout' })
      .fail(d.i.showServerResponseDialog)
      .done(debiki2.ReactActions.logout);
  },

  goToUserPage: function() {
    goToUserPage(this.state.store.user.userId);
  },

  closeSearchForm: function() {
    this.setState({
      showSearchForm: false
    });
  },

  onSearchClick: function() {
    this.setState({
      showSearchForm: !this.state.showSearchForm
    });
  },

  render: function() {
    var store: Store = this.state.store;
    var user: User = store.user;

    // Don't show all these buttons on a homepage / landing page.
    if (store.pageRole === 'HomePage')
      return null;

    var loggedInAs = !user.isLoggedIn ? null :
        r.a({ className: 'dw-name', onClick: this.goToUserPage }, user.username || user.fullName);

    var loginButton = user.isLoggedIn ? null : 
        Button({ className: 'dw-login', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, 'Log In'));

    var logoutButton = !user.isLoggedIn ? null : 
        Button({ className: 'dw-logout', onClick: this.onLogoutClick }, 'Log Out');

    var adminButton = !user.isAdmin ? null :
        Button({ className: 'dw-admin', onClick: () => {
          window.location.assign(d.i.serverOrigin + '/-/admin/?returnTo=' + location.pathname)
        }}, r.a({ className: 'icon-wrench' }, 'Admin'));

    var searchButton =
        Button({ className: 'dw-search', onClick: this.onSearchClick },
            r.span({ className: 'icon-search' }));

    var menuButton =
        DropdownButton({ title: r.span({ className: 'icon-menu' }), pullRight: true,
              className: 'dw-menu', onSelect: this.onNewNotfLevel },
            MenuItem({ eventKey: 'Watching' },
              r.a({ href: '/-/terms-of-use' }, 'Terms and Privacy')));

    var searchForm = !this.state.showSearchForm ? null :
        SearchForm({ onClose: this.closeSearchForm });

    return (
      r.div({},
        r.div({ id: 'dw-topbar-btns' },
          loggedInAs,
          loginButton,
          logoutButton,
          adminButton,
          searchButton,
          menuButton),
        searchForm));
  }
});


var SearchForm = createComponent({
  componentDidMount: function() {
    key('escape', this.props.onClose);
    $(this.refs.input.getDOMNode()).focus();
  },

  componentWillUnmount: function() {
    key.unbind('escape', this.props.onClose);
  },

  search: function() {
    $(this.refs.xsrfToken.getDOMNode()).val($['cookie']('XSRF-TOKEN'));
    $(this.refs.form.getDOMNode()).submit();
  },

  render: function() {
    return (
        r.div({ className: 'dw-lower-right-corner' },
          r.form({ id: 'dw-search-form', ref: 'form', className: 'debiki-search-form form-search',
              method: 'post', acceptCharset: 'UTF-8', action: '/-/search/site',
              onSubmit: this.search },
            r.input({ type: 'hidden', ref: 'xsrfToken', name: 'dw-fi-xsrf' }),
            r.input({ type: 'text', tabindex: '1', placeholder: 'Text to search for',
                ref: 'input', className: 'input-medium search-query', name: 'searchPhrase' }))));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
