/*
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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
/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../react-elements/name-login-btns.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.nopage {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);


/**
 * When loading the homepage (url path '/') for a website, and if there's nothing
 * to show, we'll instead mount and render this NonExistingPage component.
 * Depending on the status and purpose of the site, the component might render
 * a signup-and-become-admin button, a login button, a link to moderate
 * embedded comments, or a button to create a forum, for example.
 */
export var NonExistingPage = createComponent({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    var store: Store = this.state.store;
    var user: User = store.user;
    var siteStatus = store.siteStatus;
    var adminPendingMatch = siteStatus.match(/AdminCreationPending:(.*)/);
    if (adminPendingMatch && !user.isLoggedIn && !store.newUserAccountCreated) {
      return SignUpAsAdmin({ obfuscatedAminEmail: adminPendingMatch[1] });
    }
    else if (user.isAdmin) {
      if (siteStatus === 'IsEmbeddedSite') {
        return EmbeddedCommentsLinks(this.state.store);
      }
      else {
        return CreateSomethingHere(this.state.store);
      }
    }
    else {
      return LoginToCreateSomething(this.state.store);
    }
  }
});



export var SignUpAsAdmin = createComponent({
  render: function() {
    var startOfTheEmailAddress;
    if (this.props.obfuscatedAminEmail) {
      startOfTheEmailAddress =
        r.span({}, 'That is, ', r.samp({}, this.props.obfuscatedAminEmail + '...@...'));
    }

    var instructions = [
        'Click the button below, then click ',
        r.b({}, 'Create New Account'),
        ', or login with e.g. Google, if you specified a Gmail email address.'];

    var loginBtn =
        reactelements.NameLoginBtns({ title: 'Sign Up as Admin', purpose: 'LoginBecomeAdmin' });

    var contents = debiki.siteId === debiki.FirstSiteId
      ? r.div({},
          r.h1({}, 'Welcome'),
          r.p({}, 'You have successfully started the server.'),
          r.p({}, 'Now, please sign up using the email address you specified in the ' +
            'configuration file. ', instructions),
          r.br(),
          loginBtn)
      : r.div({},
          r.h1({}, 'Site Created'),
          r.p({}, 'Your site has been created.'),
          r.p({}, 'Now, please sign up using the email address you specified previously. ',
            startOfTheEmailAddress, instructions),
          r.br(),
          loginBtn)

    return contents;
  }
});



export var LoginToCreateSomething = createComponent({
  render: function() {
    return (
      r.div({},
        r.h1({}, 'Welcome'),
        r.p({}, 'Please login as admin to create something here.'),
        r.p({}, "If you haven't done this already: Please click the link in the " +
            "email address verification email I have sent you."),
        r.br(),
        reactelements.NameLoginBtns({ title: 'Login', purpose: 'LoginAsAdmin' })));
  }
});



export var EmbeddedCommentsLinks = createComponent({
  render: function() {
    return (
      r.div({},
        r.h1({}, 'Welcome'),
        r.p({}, 'If you have not yet configured your website to show embedded comments, ' +
            'click ', r.b({}, 'Setup Embedded Comments'), '.'),
        r.div({ className: 'do-what-options' },
          Button({ onClick: () => window.location.assign('/-/embedded-comments-help') },
              'Setup Embedded Comments'),
          Button({ onClick: () => window.location.assign('/-/admin/#/moderation') },
              'Moderate Comments'))));
  }
});



export var CreateSomethingHere = createComponent({
  getInitialState: function() {
    return {
      createWhat: undefined,
    };
  },
  render: function() {
    var createWhat = this.state.createWhat;
    var anyCreateForumPanel = createWhat === 'Forum' ?
        CreateForumPanel(this.props) : null;

    var anyCreateEmbeddedCommentsPanel = createWhat === 'EmbeddedComments' ?
        CreateEmbeddedCommentsPanel(this.props) : null;

    // For all sites except for the first one, we have already asked the user
    // if s/he wanted to create an embedded comments site, and s/he didn't.
    var message;
    var anyCreateEmbeddedCommentsButton;
    if (debiki.siteId === debiki.FirstSiteId) {
      anyCreateEmbeddedCommentsButton =
          Button({ active: createWhat === 'EmbeddedComments',
              onClick: () => this.setState({ createWhat: 'EmbeddedComments' })},
              'Setup Embedded Comments');
      message = 'This site is empty right now. What do you want to do?';
    }
    else {
      message = 'This site is empty right now. Do you want to create a forum?';
    }

    return (
      r.div({},
        r.h1({}, 'Welcome to Your Site'),
        r.p({}, message),
        r.div({ className: 'do-what-options' },
          Button({ active: createWhat === 'Forum',
              onClick: () => this.setState({ createWhat: 'Forum' })},
              'Create a Forum'),
          anyCreateEmbeddedCommentsButton),
        anyCreateForumPanel,
        anyCreateEmbeddedCommentsPanel));
  }
});



export var CreateForumPanel = createComponent({
  getInitialState: function() {
    return {
      forumName: ''
    };
  },

  handleChange: function() {
    this.setState({
      forumName: this.refs.forumName.getValue()
    });
  },

  createForum: function() {
    var data = {
      pageRole: 'Forum',
      pageStatus: 'Published',
      pageTitle: this.state.forumName,
      pageBody: 'Forum description',
      showId: false,
      pageSlug: '',
    };
    Server.createPage(data, (newPageId: string) => {
      window.location.assign('/-' + newPageId);
    });
  },

  render: function() {
    return (
      r.div({},
        Input({ type: 'text', label: 'Forum name:', placeholder: 'Enter forum name here',
            ref: 'forumName', onChange: this.handleChange }),
        Button({ onClick: this.createForum, disabled: !this.state.forumName.length },
            'Create Forum')));
  }
});



export var CreateEmbeddedCommentsPanel = createComponent({
  getInitialState: function() {
    return {
      validAddress: false
    };
  },

  onChange: function() {
    this.setState({
      validAddress: this.refs.embeddingAddress.isValid()
    });
  },

  saveEmbeddedCommentsAddress: function() {
    var setting: Setting = {
      type: 'WholeSite',
      name: 'EmbeddingSiteUrl',
      newValue: this.refs.embeddingAddress.getValue(),
    };
    Server.saveSetting(setting, () => {
      ReactActions.changeSiteStatus('IsEmbeddedSite');
    });
  },

  render: function() {
    return (
      r.div({},
        debiki2.createsite.EmbeddingAddressInput({ ref: 'embeddingAddress',
            label: 'Embedding Site Address:', onChange: this.onChange,
            help: 'Enter the address of the website where the embedded comments should appear.' }),
        Button({ onClick: this.saveEmbeddedCommentsAddress, disabled: !this.state.validAddress },
          'Create')));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
