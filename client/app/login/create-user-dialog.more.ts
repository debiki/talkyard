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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../util/FullNameInput.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="../util/UsernameInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="./new-password-input.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.login {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const FullNameInput = util.FullNameInput;
const EmailInput = util.EmailInput;


let createUserDialog;
let acceptTermsDialog;
let addressVerificationEmailSentDialog;


function getCreateUserDialog() {
  if (!createUserDialog) {
    createUserDialog = ReactDOM.render(CreateUserDialog(), utils.makeMountNode());
  }
  return createUserDialog;
}


// Is a separate terms dialog really a good idea? Good for sites with unusual terms — could
// a summary of the unusual stuff, in the dialog? E.g. decentralized commenting
// systems, where things one say cannot really be deleted.
// But in other cases, maybe makes people nervous?
// Do UX testing to find out maybe?
function waitUntilAcceptsTerms(store: Store, isOwner, after) {
  // If this is the very first site on this server, then the current user is some server
  // admin/owner who is setting up the organization's own first site — hen has already accepted
  // some employment/freelancer contract or sth like that, needn't accept any ToS here.
  if (isOwner && store.isFirstSiteAdminEmailMissing) {
    after();
    return;
  }
  if (!acceptTermsDialog) {
    acceptTermsDialog = ReactDOM.render(AcceptTermsDialog(), utils.makeMountNode());
  }
  acceptTermsDialog.waitUntilAccepts(store, isOwner, after);
}


function getAddressVerificationEmailSentDialog() {
  if (!addressVerificationEmailSentDialog) {
    addressVerificationEmailSentDialog =
        ReactDOM.render(CreateUserResultDialog(), utils.makeMountNode());
  }
  return addressVerificationEmailSentDialog;
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
  getCreateUserDialog().open(userData, anyReturnToUrl);
};


const CreateUserDialog = createClassAndFactory({
  displayName: 'CreateUserDialog',

  getInitialState: function () {
    return { isOpen: false, userData: {}, store: {} };
  },
  open: function(userData, anyReturnToUrl: string) {
    const loginDialog = login.getLoginDialog();
    this.setState({
      isOpen: true,
      userData: userData,
      afterLoginCallback: loginDialog.getAfterLoginCallback(),
      anyReturnToUrl: anyReturnToUrl,
      store: ReactStore.allData(),
    });
    // In case any login dialog is still open: (this resets the after-login-callback copied above)
    loginDialog.close();
  },
  close: function() {
    this.setState({ isOpen: false, userData: {} });
  },
  render: function () {
    const store: Store = this.state.store;
    const childProps = _.clone(this.state.userData);
    childProps.afterLoginCallback = this.state.afterLoginCallback;
    childProps.anyReturnToUrl = this.state.anyReturnToUrl;
    childProps.store = store;
    childProps.closeDialog = this.close;
    childProps.ref = 'content';
    if (store.siteStatus === SiteStatus.NoAdmin) {
      childProps.loginReason = LoginReason.BecomeAdmin;
    }
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, keyboard: false,
          dialogClassName: 'esCreateUserDlg' },
        ModalHeader({}, ModalTitle({}, t.cud.CreateUser)),
        ModalBody({}, CreateUserDialogContent(childProps))));
  }
});


export var CreateUserDialogContent = createClassAndFactory({
  displayName: 'CreateUserDialogContent',

  getInitialState: function() {
    return {
      okayStatuses: {
        fullName: true,
        email: this.props.providerId && this.props.email && this.props.email.length,
        username: false,
        password: !this.props.createPasswordUser,
      },
      userData: {
        fullName: this.props.name,
        email: this.props.email,
        username: ''
      },
    };
  },

  updateValueOk: function(what, value, isOk) {
    var data = this.state.userData;
    var okayStatuses = this.state.okayStatuses;
    data[what] = value;
    okayStatuses[what] = isOk;
    this.setState({ userData: data, okayStatuses: okayStatuses });

    // Check strength again since e.g. fullName might now be (or no longer be)
    // part of the password. But not until we've rerendered everything and sent new
    // props to the password input.
    if (what !== 'password' && this.refs.password) {
      setTimeout(this.refs.password.checkPasswordStrength, 1);
    }
  },

  setEmailOk: function(value, isOk) {
    this.updateValueOk('email', value, isOk);
  },

  doCreateUser: function() {
    const data: any = this.state.userData;
    data.returnToUrl = this.props.anyReturnToUrl;
    waitUntilAcceptsTerms(
        this.props.store, this.props.loginReason === LoginReason.BecomeAdmin, () => {
      if (this.props.authDataCacheKey) { // [4WHKTP06]
        data.authDataCacheKey = this.props.authDataCacheKey;
        Server.createOauthUser(data, this.handleCreateUserResponse, this.handleErrorResponse);
      }
      else if (this.props.createPasswordUser) {
        data.password = this.refs.password.getValue();
        Server.createPasswordUser(data, this.handleCreateUserResponse, this.handleErrorResponse);
      }
      else {
        console.error('DwE7KFEW2');
      }
    });
  },

  handleCreateUserResponse: function(response) {
    if (!response.userCreatedAndLoggedIn) {
      dieIf(response.emailVerifiedAndLoggedIn, 'EdE2TSBZ2');
      ReactActions.newUserAccountCreated();
      getAddressVerificationEmailSentDialog().sayVerifEmailSent();
    }
    else if (this.props.anyReturnToUrl && !eds.isInLoginPopup &&
        this.props.anyReturnToUrl.search('_RedirFromVerifEmailOnly_') === -1) {
      const returnToUrl = this.props.anyReturnToUrl.replace(/__dwHash__/, '#');
      const currentUrl = window.location.toString();
      // Previously, only:
      //   if (returnToUrl === currentUrl) ...
      // but was never used?
      // Now, instead, for Usability Testing Exchange [plugin]: (and perhaps better, always?)
      // (afterLoginCallback = always called after signup if logged in, and the return-to-url
      // is included in the continue-link via the email.)
      if (returnToUrl === currentUrl || this.props.afterLoginCallback) {
        const afterLoginCallback = this.props.afterLoginCallback; // gets nulled when dialogs closed
        debiki2.ReactActions.loadMyself(() => {
          if (afterLoginCallback) {
            afterLoginCallback();
          }
          getAddressVerificationEmailSentDialog().sayWelcomeLoggedIn();
        });
      }
      else {
        window.location.assign(returnToUrl);
        // In case the location didn't change, reload the page, otherwise user specific things
        // won't appear.  [redux] This reload() won't be needed later?
        window.location.reload();
      }
    }
    else {
      const isPage = $$byClass('dw-page').length;
      if (!isPage) console.log('should reload ... /? [DwE2KWF1]');
      continueOnMainPageAfterHavingCreatedUser();
    }
    this.props.closeDialog('CloseAllLoginDialogs');
  },

  handleErrorResponse: function(failedRequest: HttpRequest) {
    if (hasErrorCode(failedRequest, '_EsE403WEA_')) {
      this.setState({ theWrongEmailAddress: this.state.userData.email });
      util.openDefaultStupidDialog({
        // (This is for admins, don't translate. [5JKBWS2])
        body: "Wrong email address. Please use the email address you specified in the config file.",
      });
      return IgnoreThisError;
    }
  },

  render: function() {
    const props = this.props;
    const store: Store = props.store;
    const state = this.state;
    const hasEmailAddressAlready = props.email && props.email.length;

    const emailHelp = props.providerId && hasEmailAddressAlready ?
        t.cud.EmailVerifBy_1 + props.providerId + t.cud.EmailVerifBy_2 : null;

    // Undefined —> use the default, which is True.  ... but for now, always require email [0KPS2J]
    const emailOptional = false; // store.settings.requireVerifiedEmail === false;

    const emailInput =
        EmailInput({ label: emailOptional ? t.cud.EmailOptPriv : t.cud.EmailPriv, id: 'e2eEmail',
          onChangeValueOk: (value, isOk) => this.setEmailOk(value, isOk), tabIndex: 1,
          // If email already provided by e.g. Google, don't let the user change it.
          disabled: hasEmailAddressAlready, defaultValue: props.email, help: emailHelp,
          required: true, // [0KPS2J] store.settings.requireVerifiedEmail !== false,
          error: this.state.userData.email !== this.state.theWrongEmailAddress ?
              // (This is for admins, don't translate. [5JKBWS2])
              null : "Use the email address you specified in the config file." });

    const usernameInput =
        util.UsernameInput({ label: t.cud.Username, id: 'e2eUsername', tabIndex: 2,
          onChangeValueOk: (value, isOk) => this.updateValueOk('username', value, isOk)
        });

    const passwordInput = props.createPasswordUser
        ? NewPasswordInput({ newPasswordData: state.userData, ref: 'password', tabIndex: 2,
              setPasswordOk: (isOk) => this.updateValueOk('password', 'dummy', isOk) })
        : null;

    const fullNameInput =
      FullNameInput({ label: t.cud.FullName, ref: 'fullName',
        id: 'e2eFullName', defaultValue: props.name, tabIndex: 2,
        onChangeValueOk: (value, isOk) => this.updateValueOk('fullName', value, isOk) });

    const disableSubmit = _.includes(_.values(this.state.okayStatuses), false);

    return (
      r.form({ className: 'esCreateUser' },
        emailInput,
        usernameInput,
        // Place the full name input above the password input, because someone thought
        // the full-name-input was a password verification field.
        fullNameInput,
        passwordInput,
        PrimaryButton({ onClick: this.doCreateUser, disabled: disableSubmit, id: 'e2eSubmit',
            tabIndex: 2 }, t.cud.CreateAccount)));
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

  if (eds.isInLoginPopup) {
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

  // We should be on some kind of a discussion page.
  // This continues e.g. whatever the user attempted to do before she was asked to login
  // and create a user.
  login.continueAfterLogin();

  if (eds.isInLoginPopup) {
    close();  // closes the popup window
  }
}


const AcceptTermsDialog = createComponent({
  displayName: 'AcceptTermsDialog',

  getInitialState: function () {
    return { isOpen: false };
  },
  waitUntilAccepts: function(store, isOwner, after) {
    this.setState({
      isOpen: true,
      accepts: false,
      store,
      isOwner,
      after
    });
  },
  close: function() {
    const accepts = this.state.accepts;
    this.setState({ isOpen: false });
    if (accepts) {
      this.state.after();
    }
  },
  render: function () {
    const isOwner = this.state.isOwner;
    const accepts = this.state.accepts;
    const store = this.state.store;
    const termsUrl = isOwner ?
        store.siteOwnerTermsUrl || '/-/terms-for-site-owners': '/-/terms-of-use';
    const privacyUrl = isOwner ?
        store.siteOwnerPrivacyUrl || '/-/privacy-for-site-owners' : '/-/privacy-policy';
    return (
      // Don't set onHide — shouldn't be closeable by clicking outside, only by choosing Yes.
      Modal({ show: this.state.isOpen },
        ModalHeader({}, ModalTitle({}, t.terms.TermsAndPrivacy)),
        ModalBody({}, r.p({},
            t.terms.Accept_1,
            r.a({ href: termsUrl, target: '_blank', id: 'e_TermsL' },
              // We're providing a Software-as-a-Service to site owners — "Service" is a better word?
              // However, ordinary users merely use the website — then use the word "Use"?
              isOwner ? t.terms.TermsOfService : t.terms.TermsOfUse),
            t.terms.Accept_2,
            r.a({ href: privacyUrl, target: '_blank', id: 'e_PrivacyL' }, t.terms.PrivPol),
            isOwner ?
                t.terms.Accept_3_Owner : t.terms.Accept_3_User),
          Input({ type: 'checkbox', className: 's_TermsD_CB' + (accepts ? ' s_TermsD_CB-Accepts' : ''),
            label: t.terms.YesAccept, checked: accepts,
            onChange: (event) => this.setState({ accepts: event.target.checked }) })),
        ModalFooter({},
          Button({ onClick: this.close, id: 'e_TermsD_B',
              className: accepts ? 'btn-primary' : '' },
            accepts ? t.Continue : t.Cancel))));
  }
});



const CreateUserResultDialog = createComponent({
  displayName: 'CreateUserResultDialog',

  getInitialState: function () {
    return { isOpen: false };
  },
  sayVerifEmailSent: function() {
    this.setState({ isOpen: true });
  },
  sayWelcomeLoggedIn: function() {
    this.setState({ isOpen: true, isLoggedIn: true });
  },
  close: function() {
    this.setState({ isOpen: false });
  },
  render: function () {
    const id = this.state.isLoggedIn ? 'te_WelcomeLoggedIn' : 'e2eNeedVerifyEmailDialog';
    const text = this.state.isLoggedIn ? t.cud.DoneLoggedIn : t.cud.AlmostDone;
    // Don't show a close-dialog button if there nothing on the page, after dialog closed.
    const footer = eds.isInLoginPopup ? null :
        ModalFooter({},
          PrimaryButton({ onClick: this.close }, t.Okay));
    return (
      Modal({ show: this.state.isOpen, onHide: this.close, id },
        ModalHeader({}, ModalTitle({}, t.Welcome)),
        ModalBody({}, r.p({}, text)),
        footer));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
