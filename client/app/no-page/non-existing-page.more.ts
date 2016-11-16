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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.nopage {
//------------------------------------------------------------------------------

var r = React.DOM;


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
    var me: Myself = store.me;
    var siteStatus = store.siteStatus;
    var adminPendingMatch = siteStatus === SiteStatus.NoAdmin ||
        store.isFirstSiteAdminEmailMissing;
    if (adminPendingMatch && !me.isLoggedIn && !store.newUserAccountCreated) {
      return SignUpAsAdmin(this.state.store);
    }
    else if (me.isAdmin) {
      /*
      if (siteStatus === 'IsEmbeddedSite') {  -- embedded comments disabled [5EU0232]
        return EmbeddedCommentsLinks(this.state.store);
      }
      else {
      */
      return CreateSomethingHere(this.state.store);
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

    var anyEmailProblem = this.props.isFirstSiteAdminEmailMissing
      ? r.p({ style: { color: 'hsl(0, 100%, 45%)', fontWeight: 'bold' }},
          "But you haven't specified any ", r.code({}, 'debiki.becomeOwnerEmailAddress'),
          " value in the config file — please edit it and do so.", r.br(),
          "Then restart the app server: ", r.code({}, "docker-compose restart app"))
      : null;

    var loginBtn =
        PrimaryButton({ id: 'e2eLogin', disabled: !!anyEmailProblem,
            onClick: () => login.getLoginDialog().openToSignUp(LoginReason.BecomeAdmin) },
          "Continue");

    return debiki.siteId === debiki.FirstSiteId
      ? r.div({},
          r.h1({}, "Welcome"),
          r.p({}, "You have successfully started the server."),
          r.p({}, "Next, sign up using the email address you specified in the " +
            "configuration file in the ", r.code({}, 'becomeOwnerEmailAddress'), " field."),
          anyEmailProblem,
          r.br(),
          loginBtn)
      : r.div({},
          r.h1({}, "Welcome"),
          r.p({}, "This is your new website"),
          r.p({}, "Look at the address bar above — it starts with the address " +
              "you specified: ", r.code({}, location.hostname)),
          r.br(),
          loginBtn);
  }
});



export var LoginToCreateSomething = createComponent({
  getInitialState: function() {
    return {};
  },

  sendEmailAgain: function() {
    Server.sendAddressVerifEmailAgain(() => {
      util.openDefaultStupidDialog({
        body: "Email sent (unless your email address has been verified already)" });
      this.setState({ emailSentAgain: true });
    })
  },

  render: function() {
    let sendEmailAgainButton = this.state.emailSentAgain ? null :
      Button({ onClick: this.sendEmailAgain, className: 's_NP_EmailAgainB' },
        "Send email again");

    return (
      r.div({},
        r.h1({}, "Welcome"),
        r.p({}, "Please login as admin to create something here."),
        r.p({}, "If you haven't done this already: Please click the link in the " +
            "email address verification email I have sent you."),
        r.br(),
        reactelements.NameLoginBtns({ title: "Login", purpose: 'LoginAsAdmin' }),
        sendEmailAgainButton));
  }
});



export var EmbeddedCommentsLinks = createComponent({
  render: function() {
    return (
      r.div({},
        r.h1({}, "Welcome"),
        r.p({}, "If you have not yet configured your website to show embedded comments, " +
            "click ", r.b({}, "Setup Embedded Comments"), '.'),
        r.div({ className: 'do-what-options' },
          Button({ onClick: () => window.location.assign('/-/embedded-comments-help') },
              "Setup Embedded Comments"),
          Button({ onClick: () => window.location.assign('/-/admin/#/moderation') },
              "Moderate Comments"))));
  }
});



export var CreateSomethingHere = createComponent({
  getInitialState: function() {
    return {
      createWhat: PageRole.Forum, // later: undefined — if there'll be Blog and Wiki too? [8GYK34]
    };
  },
  render: function() {
    var createWhat: PageRole = this.state.createWhat;
    var anyCreateForumPanel = createWhat === PageRole.Forum ?
        CreateForumPanel(this.props) : null;

    var anyCreateEmbeddedCommentsPanel = createWhat === PageRole.EmbeddedComments ?
        CreateEmbeddedCommentsPanel(this.props) : null;

    // For all sites except for the first one, we have already asked the user
    // if s/he wanted to create an embedded comments site, and s/he didn't.
    var message;
    var anyCreateEmbeddedCommentsButton;
    /*
    if (false) { // if (debiki.siteId === debiki.FirstSiteId) { // embedded comments broken now
      anyCreateEmbeddedCommentsButton =
          Button({ active: createWhat === PageRole.EmbeddedComments,
              onClick: () => this.setState({ createWhat: 'EmbeddedComments' })},
              'Setup Embedded Comments');
      message = 'This site is empty right now. What do you want to do?';
    }
    else { */
      message = "This site is empty right now. Do you want to create a forum?";
    //}


    return (
      r.div({},
        r.h1({}, "Forum name"),
        r.p({}, "What shall the forum be named? (You can rename it later.)"),
        /* Add this back later if there'll be Blog and Wiki options too [8GYK34]
        r.p({}, message),
        r.div({ className: 'do-what-options' },
          PrimaryButton({ active: createWhat === PageRole.Forum, id: 'e2eCreateForum',
              disabled: anyCreateForumPanel || anyCreateEmbeddedCommentsPanel,
              onClick: () => this.setState({ createWhat: PageRole.Forum })},
              'Create a Forum'),
          anyCreateEmbeddedCommentsButton),
          */
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
    Server.createForum(this.state.forumName, '/', (forumUrlPath: string) => {
      window.location.assign(forumUrlPath);
    });
  },

  render: function() {
    return (
      r.div({},
        Input({ type: 'text', label: "Forum name:", placeholder: "Enter forum name here",
            ref: 'forumName', onChange: this.handleChange }),
        PrimaryButton({ onClick: this.createForum, disabled: !this.state.forumName.length,
            id: 'e2eDoCreateForum' }, "Create Forum")));
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
    die("Unimplemented [EsE4KUPKFW2]"); // the old complicated settings stuff is now gone
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
