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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../utils/react-utils.ts" />
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


var createUserDialog;
var addressVerificationEmailSentDialog;


function getCreateUserDialogs() {
  if (!createUserDialog) {
    createUserDialog = React.render(CreateUserDialog(), utils.makeMountNode());
  }
  return createUserDialog;
}


function getAddressVerificationEmailSentDialog() {
  if (!addressVerificationEmailSentDialog) {
    addressVerificationEmailSentDialog =
        React.render(AddressVerificationEmailSentDialog(), utils.makeMountNode());
  }
  return addressVerificationEmailSentDialog;
}


debiki.internal.makeReturnToPostUrlForVerifEmail = function(postId) {
  // The magic '__Redir...' string tells the server to use the return-to-URL only if it
  // needs to send an email address verification email (it'd include the return
  // to URL on a welcome page show via a link in the email).
  // '__dwHash__' is an encoded hash that won't be lost when included in a GET URL.
  // The server replaces it with '#' later on.
  // `d.i.iframeBaseUrl` is for embedded comments in an <iframe>: it's the URL of
  // the embedding parent page.
  var pageUrl = d.i.iframeBaseUrl ? d.i.iframeBaseUrl : window.location.toString();
  return '_RedirFromVerifEmailOnly_' +
    pageUrl.replace(/#.*/, '') +
    '__dwHash__' +
    'post-' + postId;
};


// Backwards compatibility, for now:
/**
 * Prefix `RedirFromVerifEmailOnly` to the return-to-url, to indicate that
 * the redirect should happen only if an email address verification email is sent,
 * and via a link in that email.
 *
 * userData: { name, email, authDataCacheKey }
 */
debiki.internal.showCreateUserDialog = function(userData, anyReturnToUrl) {
  getCreateUserDialogs().open(userData, anyReturnToUrl);
};


var CreateUserDialog = createClassAndFactory({
  getInitialState: function () {
    return { isOpen: false, userData: {} };
  },
  open: function(userData, anyReturnToUrl: string) {
    // In case any login dialog is still open:
    login.getLoginDialog().close();
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
      passwordOk: !this.props.createPasswordUser,
      userData: { fullName: '', email: '', username: '' },
    };
  },

  setPasswordOk: function(passwordOk: boolean) {
    this.setState({
      passwordOk: passwordOk
    });
  },

  updateUserData: function() {
    this.setState({
      userData: {
        fullName: this.refs.fullNameInput.getValue(),
        email: this.props.emailAddress || this.refs.emailInput.getValue(),
        username: this.refs.usernameInput.getValue(),
      }
    });
    // Check strength again since e.g. fullName might now be (or no longer be)
    // part of the password. But not until we've rerendered everything and sent new
    // props to the password input.
    setTimeout(this.refs.passwordInput.checkPasswordStrength, 1);
  },

  doCreateUser: function() {
    var data: any = this.state.userData;
    data.returnToUrl = this.props.anyReturnToUrl;
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
      getAddressVerificationEmailSentDialog().open();
    }
    else if (this.props.anyReturnToUrl && !debiki.internal.isInLoginPopup &&
        this.props.anyReturnToUrl.search('_RedirFromVerifEmailOnly_') === -1) {
      window.location.assign(this.props.anyReturnToUrl);
    }
    else if (!window['debiki2']) {
      // COULD remove — this cannot hapen any longer, loading the same script bundle
      // everywhere right now. Remove this?
      // We haven't loaded all JS that would be needed to continue on the same page.
      window.location.assign('/');
    }
    else {
      var isPage = $('.dw-page');
      if (!isPage) console.log('should reload ... /? [DwE2KWF1]');
      continueOnMainPageAfterHavingCreatedUser();
    }
  },

  render: function() {
    var props = this.props;
    var state = this.state;

    var fullNameInput =
        Input({ type: 'text', label: "Your name: (the long version)", ref: 'fullNameInput',
            defaultValue: props.name, onChange: this.updateUserData });

    var anyEmailHelp = props.providerId ?
        "Your email has been verified by " + props.providerId + "." : null;

    var emailInput =
        Input({ type: 'text', label: "Email: (will be kept private)", ref: 'emailInput',
            // If email already provided by e.g. Google, don't let the user change it.
            disabled: props.email && props.email.length, defaultValue: props.email,
            help: anyEmailHelp, onChange: this.updateUserData });

    var usernameInput =
        Input({ type: 'text', label: "Username:", ref: 'usernameInput',
            onChange: this.updateUserData, help: r.span({},
              "Your ", r.code({}, "@username"), " must be unique, short, no spaces.") });

    var passwordInput = props.createPasswordUser
        ? NewPasswordInput({ newPasswordData: state.userData, setPasswordOk: this.setPasswordOk,
              ref: 'passwordInput' })
        : null;

    return (
      r.form({},
        fullNameInput,
        emailInput,
        usernameInput,
        passwordInput,
        Button({ onClick: this.doCreateUser, disabled: !state.passwordOk }, "Create User"),
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
