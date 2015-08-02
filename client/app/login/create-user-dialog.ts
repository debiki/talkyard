/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
/// <reference path="../ReactStore.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.login {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var ButtonGroup = reactCreateFactory(ReactBootstrap.ButtonGroup);
var Input = reactCreateFactory(ReactBootstrap.Input);
var ButtonInput = reactCreateFactory(ReactBootstrap.ButtonInput);
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);


export var createUserDialog;
var addressVerificationEmailSentDialog;


export function createCreateUserDialogs() {
  function makeMountNode() {
    return $('<div>').appendTo('body')[0];
  }
  createUserDialog = React.render(CreateUserDialog(), makeMountNode());
  addressVerificationEmailSentDialog =
      React.render(AddressVerificationEmailSentDialog(), makeMountNode());
}


// Backwards compatibility, for now:
/**
 * Prefix `RedirFromVerifEmailOnly` to the return-to-url, to indicate that
 * the redirect should happen only if an email address verification email is sent,
 * and via a link in that email.
 *
 * userData: { name, email, authDataCacheKey }
 */
debiki.internal.showCreateUserDialog = function(userData, anyReturnToUrl) {
  createUserDialog.open(userData, anyReturnToUrl);
};


var CreateUserDialog = createClassAndFactory({
  getInitialState: function () {
    return { isOpen: false, userData: {} };
  },
  open: function(userData, anyReturnToUrl: string) {
    // In case any login dialog is still open:
    login.loginDialog.close();
    this.setState({
      isOpen: true,
      userData: userData,
      anyReturnToUrl: anyReturnToUrl,
    });
  },
  close: function() {
    this.setState({ isOpen: false, userData: {} });
  },
  render: function () {
    var childProps = _.clone(this.state.userData);
    childProps.anyReturnToUrl = this.state.anyReturnToUrl;
    childProps.closeDialog = this.close;
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, keyboard: false },
        ModalHeader({}, ModalTitle({}, "Create User")),
        ModalBody({}, CreateUserDialogContent(childProps))));
  }
});


export var CreateUserDialogContent = createClassAndFactory({
  getInitialState: function() {
    return {
      zxcvbnLoaded: false,
    };
  },

  componentDidMount: function() {
    // The password strength test library is large, because it contains lists of all words.
    window['yepnope']({
      load:  debiki.internal.assetsUrlPathStart + 'zxcvbn.js',
      complete: () => {
        this.setState({ zxcvbnLoaded: true });
      }
    });
  },

  doCreateUser: function() {
    if (!this.state.zxcvbnLoaded) {
      alert("zxcvbn.js not yet loaded, why not, what is the server doing? [DwE50GP3]");
      return;
    }
    var data: any = {
      name: this.refs.fullNameInput.getValue(),
      email: this.props.emailAddress || this.refs.emailInput.getValue(),
      username: this.refs.usernameInput.getValue(),
      returnToUrl: this.props.anyReturnToUrl,
    };
    if (this.props.authDataCacheKey) {
      data.authDataCacheKey = this.props.authDataCacheKey;
      Server.createOauthUser(data, this.handleCreateUserResponse);
    }
    else if (this.props.createPasswordUser) {
      data.password = this.refs.passwordInput.getValue();
      Server.createPasswordUser(data, this.handleCreateUserResponse);
    }
    else {
      console.error('DwE7KFEW2');
    }
  },

  handleCreateUserResponse: function(response) {
    this.props.closeDialog('CloseAllLoginDialogs');
    if (!response.emailVerifiedAndLoggedIn) {
      ReactActions.newUserAccountCreated();
      addressVerificationEmailSentDialog.open();
    }
    else if (this.props.anyReturnToUrl && !debiki.internal.isInLoginPopup &&
        this.props.anyReturnToUrl.search('_RedirFromVerifEmailOnly_') === -1) {
      window.location.assign(this.props.anyReturnToUrl);
    }
    else if (!window['debiki2']) {
      // We haven't loaded all JS that would be needed to continue on the same page.
      window.location.assign('/');
    }
    else {
      var isPage = $('.dw-page');
      if (!isPage) console.log('should reload ... /?');
      continueOnMainPageAfterHavingCreatedUser();
    }
  },

  render: function() {
    var props = this.props;

    var fullNameInput =
        Input({ type: 'text', label: "Your name: (the long version)", ref: 'fullNameInput',
            defaultValue: props.name });

    var anyEmailHelp = props.providerId ?
        "Your email has been verified by " + props.providerId + "." : null;

    var emailInput = 
        Input({ type: 'text', label: "Email: (will be kept private)", ref: 'emailInput',
            // If email already provided by e.g. Google, don't let the user change it.
            disabled: props.email && props.email.length, defaultValue: props.email,
            help: anyEmailHelp });

    var usernameInput =
        Input({ type: 'text', label: "Username:", ref: 'usernameInput',
            help: r.span({},
              "Your ", r.code({}, "@username"), " must be unique, short, no spaces.") });

    var passwordInput = props.createPasswordUser
        ? Input({ type: 'password', label: "Password:", ref: 'passwordInput' })
        : null;

    return (
      r.form({},
        fullNameInput,
        emailInput,
        usernameInput,
        passwordInput,
        Button({ onClick: this.doCreateUser }, "Create User"),
        Button({ onClick: props.closeDialog }, "Cancel")));
  }
});


function continueOnMainPageAfterHavingCreatedUser() {
  // If this is an embedded comments site, we're currently executing in
  // a create user login popup window, not in the <iframe> on the embedding
  // page. If so, only window.opener has loaded the code that we're
  // about to execute.
  var debikiInternal;
  var d2;

  // This won't work, might have been opened via other Debiki tab?
  //    if (window.opener && window.opener['debiki']) {

  if (d.i.isInLoginPopup) {
    // We're in a login popup window for an embedded comments site. Continue in the opener tab
    // and close this popup (at the end of this function).
    debikiInternal = window.opener['debiki'].internal;
    d2 = window.opener['debiki2'];
  }
  else {
    // We're in the correct browser tab already. This is not an embedded comments site;
    // we're not in a popup window. So we can execute the subsequent code in this tab.
    debikiInternal = debiki.internal;
    d2 = debiki2;
  }

  // We should be on some kind of a discussion page, so trigger the login action so it'll
  // update. (Perhaps rename ReactActions.login() to .loggedIn() or something like that?)
  d2.ReactActions.login()

  // This continues e.g. whatever the user attempted to do before she was asked to login
  // and create a user.
  debikiInternal.continueAnySubmission();

  if (d.i.isInLoginPopup) {
    debikiInternal.closeAnyLoginDialogs();
    close();
  }
}


var AddressVerificationEmailSentDialog = createComponent({
  getInitialState: function () {
    return { isOpen: false };
  },
  open: function() {
    this.setState({ isOpen: true });
  },
  close: function() {
    this.setState({ isOpen: false });
  },
  render: function () {
    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Welcome")),
        ModalBody({},
          r.p({}, "Almost done! You just need to confirm your email address. We have " +
              "sent an email to you. Please click the link in the email to activate " +
              "your account. You can close this page.")),
        ModalFooter({},
          Button({ onClick: this.close }, 'Okay'))));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
