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
/// <reference path="../login/login-dialog.ts" />
/// <reference path="../page-tools/page-tools.ts" />
/// <reference path="../utils/page-scroll-mixin.ts" />
/// <reference path="../post-navigation/posts-trail.ts" />
/// <reference path="name-login-btns.ts" />
/// <reference path="../../typedefs/keymaster/keymaster.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.reactelements {
//------------------------------------------------------------------------------

var keymaster: Keymaster = window['keymaster'];
var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var DropdownButton = reactCreateFactory(ReactBootstrap.DropdownButton);
var MenuItem = reactCreateFactory(ReactBootstrap.MenuItem);


export var TopBar = createComponent({
  mixins: [debiki2.StoreListenerMixin, debiki2.utils.PageScrollMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
      showSearchForm: false,
      fixed: false,
      initialOffsetTop: -1,
    };
  },

  componentDidMount: function() {
    var rect = this.getDOMNode().getBoundingClientRect();
    this.setState({
      initialOffsetTop: rect.top + window.pageYOffset,
      initialHeight: rect.bottom - rect.top,
    });
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData()
    });
  },

  onScroll: function(event) {
    var node = this.getDOMNode();
    if (!this.state.fixed) {
      if (node.getBoundingClientRect().top < -8) {
        this.setState({ fixed: true });
      }
    }
    else {
      // Add +X otherwise sometimes the fixed state won't vanish although back at top of page.
      if (window.pageYOffset < this.state.initialOffsetTop + 5) {
        this.setState({ fixed: false });
      }
    }
  },

  onLoginClick: function() {
    // COULD call new fn ReactActions.login() instead?
    login.loginDialog.open(this.props.purpose || 'LoginToLogin');
  },

  onLogoutClick: function() {
    // COULD let ReactActions call Server instead.
    debiki2.Server.logout(debiki2.ReactActions.logout);
  },

  goToUserPage: function() {
    goToUserPage(this.state.store.user.userId);
  },

  goToAdminPage: function() {
    sessionStorage.setItem('returnToUrl', window.location.toString());
    window.location.assign(d.i.serverOrigin + '/-/admin/');
  },

  showTools: function() {
    pagetools.pageToolsDialog.open();
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

  goToTop: function() {
    debiki2.postnavigation.addVisitedPosition();
    $('.dw-page')['dwScrollIntoView']();
  },

  goToReplies: function() {
    debiki2.postnavigation.addVisitedPosition();
    $('#dw-cmts-tlbr')['dwScrollIntoView']({ marginTop: 60, marginBottom: 9999 });
  },

  goToChat: function() {
    debiki2.postnavigation.addVisitedPosition();
    $('#dw-chat')['dwScrollIntoView']({ marginTop: 60, marginBottom: 9999 });
  },

  goToEnd: function() {
    debiki2.postnavigation.addVisitedPosition();
    $('#dw-the-end')['dwScrollIntoView']({ marginTop: 60, marginBottom: 30 });
  },

  render: function() {
    var store: Store = this.state.store;
    var user: User = store.user;
    var pageRole = store.pageRole;

    // Don't show all these buttons on a homepage / landing page, until after has scrolled down.
    // If not logged in, never show it — there's no reason for new users to login on the homepage.
    if (pageRole === PageRole.HomePage && (!this.state.fixed || !user))
      return r.span({});

    var goToButtons;
    if (this.state.fixed && pageRole !== PageRole.HomePage && pageRole !== PageRole.Forum) {
      var topHelp = "Go to the top of the page";
      var repliesHelp = "Go to the replies section. There are " + store.numPostsRepliesSection +
        " replies."
      var chatHelp = "Go to the chat section. There are " + store.numPostsChatSection +
        " comments.";
      var endHelp = "Go to the bottom of the page";

      var goToTop = Button({ className: 'dw-goto', onClick: this.goToTop, title: topHelp }, "Top");
      var goToReplies = Button({ className: 'dw-goto', onClick: this.goToReplies,
            title: repliesHelp }, "Replies (" + store.numPostsRepliesSection + ")");
      var goToChat = Button({ className: 'dw-goto', onClick: this.goToChat,
            title: chatHelp }, "Chat (" + store.numPostsChatSection + ")");
      var goToEnd = Button({ className: 'dw-goto', onClick: this.goToEnd, title: endHelp }, "End");

      goToButtons = r.span({ className: 'dw-goto-btns' },
          goToTop, goToReplies, goToChat, goToEnd, debiki2.postnavigation.PostNavigation());
    }

    var loggedInAs = !user.isLoggedIn ? null :
        r.a({ className: 'dw-name', onClick: this.goToUserPage }, user.username || user.fullName);

    var loginButton = user.isLoggedIn ? null : 
        Button({ className: 'dw-login', onClick: this.onLoginClick },
            r.span({ className: 'icon-user' }, 'Log In'));

    var logoutButton = !user.isLoggedIn ? null : 
        Button({ className: 'dw-logout', onClick: this.onLogoutClick }, 'Log Out');

    var adminButton = !isStaff(user) ? null :
        Button({ className: 'dw-admin', onClick: this.goToAdminPage },
          r.a({ className: 'icon-settings' }, 'Admin'));

    var toolsButton = !isStaff(user) || pagetools.pageToolsDialog.isEmpty() ? null :
        Button({ className: 'dw-a-tools', onClick: this.showTools },
          r.a({ className: 'icon-wrench' }, 'Tools'));

    var searchButton =
        null;
    /* Hide for now, search broken, after I rewrote from dw1_posts to dw2_posts.
        Button({ className: 'dw-search', onClick: this.onSearchClick },
            r.span({ className: 'icon-search' }));
    */

    var menuButton =
        DropdownButton({ title: r.span({ className: 'icon-menu' }), pullRight: true,
              className: 'dw-menu' },
            // Links in dropdown MenuItem:s no longer work after I upgraded react-bootstrap,
            // so add onClick. Try to remove ... later? Year 2016?
            MenuItem({ onClick: () => window.location.assign('/-/terms-of-use') },
              r.a({ href: '/-/terms-of-use' }, 'Terms and Privacy')));

    var searchForm = !this.state.showSearchForm ? null :
        SearchForm({ onClose: this.closeSearchForm });

    var pageTitle;
    if (pageRole === PageRole.Forum) {
      var titleProps: any = _.clone(store);
      titleProps.hideTitleEditButton = this.state.fixed;
      pageTitle =
          r.div({ className: 'dw-topbar-title' }, Title(titleProps));
    }

    var topbar =
      r.div({ id: 'dw-react-topbar', className: 'clearfix' },
        pageTitle,
        goToButtons,
        r.div({ id: 'dw-topbar-btns' },
          loggedInAs,
          loginButton,
          logoutButton,
          adminButton,
          toolsButton,
          searchButton,
          menuButton),
        searchForm);

    var placeholder;
    var fixItClass;
    var containerClass;
    if (this.state.fixed) {
      // The placeholder prevents the page height from suddenly changing when the
      // topbar becomes fixed and thus is removed from the flow.
      placeholder = r.div({ style: { height: this.state.initialHeight }});
      fixItClass = 'dw-fixed-topbar-wrap';
      containerClass = 'container';
    }
    return (
      r.div({},
        placeholder,
        r.div({ className: fixItClass },
          r.div({ className: containerClass },
            topbar))));
  }
});


var SearchForm = createComponent({
  componentDidMount: function() {
    keymaster('escape', this.props.onClose);
    $(this.refs.input.getDOMNode()).focus();
  },

  componentWillUnmount: function() {
    keymaster.unbind('escape', this.props.onClose);
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
