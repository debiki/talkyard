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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../widgets.more.ts" />
/// <reference path="../util/FullNameInput.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="../util/UsernameInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="./new-password-input.more.ts" />
/// <reference path="./login-dialog.more.ts" />

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


interface NewUserData {
  username: string;
  fullName: string;
  email: string;
  authDataCacheKey?: string;
}

interface CreateUserPostData extends NewUserData {
  password?: string;
  returnToUrl: string;
}


// Backwards compatibility, for now:
/**
 * Prefix `RedirFromVerifEmailOnly` to the return-to-url, to indicate that
 * the redirect should happen only if an email address verification email is sent,
 * and via a link in that email.
 */
debiki.internal.showCreateUserDialog = function(userData: NewUserData, anyReturnToUrl) {
  getCreateUserDialog().open(userData, anyReturnToUrl);
};


const CreateUserDialog = createClassAndFactory({
  displayName: 'CreateUserDialog',

  getInitialState: function () {
    return { isOpen: false, userData: undefined, store: {} };
  },

  open: function(userData: NewUserData, anyReturnToUrl: string) {
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
    this.setState({ isOpen: false, userData: undefined });
  },

  render: function () {
    const store: Store = this.state.store;

    let content;
    if (this.state.isOpen) {
      const childProps = {
        ...this.state.userData,
        store,
        afterLoginCallback: this.state.afterLoginCallback,
        anyReturnToUrl: this.state.anyReturnToUrl,
        closeDialog: this.close,
      };
      if (store.siteStatus === SiteStatus.NoAdmin) {
        childProps.loginReason = LoginReason.BecomeAdmin;
      }
      content = CreateUserDialogContent(childProps);
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, keyboard: false,
          dialogClassName: 'esCreateUserDlg' },
        ModalHeader({}, ModalTitle({}, t.cud.CreateUser)),
        ModalBody({}, content)));
  }
});


export var CreateUserDialogContent = createClassAndFactory({
  displayName: 'CreateUserDialogContent',

  getInitialState: function() {
    // @ifdef DEBUG
    dieIf(this.props.isForGuest && this.props.isForPasswordUser, 'TyE7UKWQ1');
    dieIf(this.props.isForGuest && this.props.providerId, 'TyE7UKWQ2');
    dieIf(this.props.isForPasswordUser && this.props.providerId, 'TyE7UKWQ3');
    // @endif

    return {
      okayStatuses: {
        // Full name / alias / display name, is required, for guests.
        fullName: !this.props.isForGuest,
        // providerId always missing in emb cmts openauth popup?
        email: this.props.providerId && !!this.props.email,
        // Guests have no username or password.
        username: this.props.isForGuest || (
            this.props.username && this.props.username.length >= 3), // [6KKAQDD0]
        password: !this.props.isForPasswordUser,
      },
      userData: {
        fullName: this.props.fullName,
        email: this.props.email,
        username: this.props.username || '',
      },
    };
  },

  updateValueOk: function(what, value, isOk) {
    const data = this.state.userData;
    const okayStatuses = this.state.okayStatuses;
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
    const data: CreateUserPostData = this.state.userData;
    data.returnToUrl = this.props.anyReturnToUrl;
    waitUntilAcceptsTerms(this.props.store, this.props.loginReason === LoginReason.BecomeAdmin, () => {
      if (this.props.authDataCacheKey) { // [4WHKTP06]
        data.authDataCacheKey = this.props.authDataCacheKey;
        Server.createOauthUser(data, this.handleCreateUserResponse, this.handleErrorResponse);
      }
      else if (this.props.isForPasswordUser) {
        data.password = this.refs.password.getValue();
        Server.createPasswordUser(data, this.handleCreateUserResponse, this.handleErrorResponse);
      }
      else if (this.props.isForGuest) {
        Server.loginAsGuest(
            data.fullName, data.email, this.handleCreateUserResponse, this.handleErrorResponse);
      }
      else {
        console.error('DwE7KFEW2');
      }
    });
  },

  handleCreateUserResponse: function(response: GuestLoginResponse) {
    if (!response.userCreatedAndLoggedIn) {
      dieIf(response.emailVerifiedAndLoggedIn, 'EdE2TSBZ2');
      ReactActions.newUserAccountCreated();

      // Don't show a close button, if creating new site, because people click it
      // directly without reading the message about checking their email inbox. Then
      // they don't know what to do, and are stuck.
      // (Probably this email verif step needs to be totally removed. [SIMPLNEWSITE]
      const mayCloseDialog = this.props.loginReason !== LoginReason.BecomeAdmin;
      getAddressVerificationEmailSentDialog().sayVerifEmailSent(mayCloseDialog);
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
      // We're on a discussion page, or in a login popup.
      // Continue whatever the user attempted to do, before hen was asked to sign up.
      login.continueAfterLogin();

      // If we're in a login popup, close it & let focus return to the main window.
      if (eds.isInLoginPopup) {
        close();
      }
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
    const isForGuest = this.props.isForGuest;

    const emailHelp = props.providerId && hasEmailAddressAlready ?
        t.cud.EmailVerifBy_1 + props.providerId + t.cud.EmailVerifBy_2 : null;

    // Undefined —> use the default, which is True.  ... but for now, always require email [0KPS2J]
    const emailOptional = false; // store.settings.requireVerifiedEmail === false;
    const wrongAddr = this.state.theWrongEmailAddress;

    const emailInput =
        EmailInput({ label: emailOptional ? t.cud.EmailOptPriv : t.cud.EmailPriv, id: 'e2eEmail',
          onChangeValueOk: (value, isOk) => this.setEmailOk(value, isOk), tabIndex: 1,
          // If email already provided by e.g. Google, don't let the user change it.
          disabled: hasEmailAddressAlready, defaultValue: props.email, help: emailHelp,
          required: !isForGuest, // [0KPS2J] store.settings.requireVerifiedEmail !== false,
          // If is first site admin signup, and the admin keeps using an email address we know is
          // not the one in the config file, then tell hen to use the addr in the config file.
          // (This is for admins, don't translate. [5JKBWS2])
          error: this.state.userData.email !== wrongAddr || !wrongAddr ?
              null : "Use the email address you specified in the config file." });

    const usernameInputMaybe = isForGuest ? null :
        util.UsernameInput({ label: t.cud.Username, id: 'e2eUsername', tabIndex: 1,
          defaultValue: props.username,
          onChangeValueOk: (value, isOk) => this.updateValueOk('username', value, isOk)
        });

    const passwordInputMaybe = !props.isForPasswordUser ? null :
        NewPasswordInput({ newPasswordData: state.userData, ref: 'password', tabIndex: 1,
            minLength: store.settings.minPasswordLength,
            setPasswordOk: (isOk) => this.updateValueOk('password', 'dummy', isOk) });

    const fullNameInput =
      FullNameInput({ label: isForGuest ? t.NameC : t.cud.FullName, ref: 'fullName',
        minLength: isForGuest ? 2 : undefined, // guests have no username to show instead
        id: 'e2eFullName', defaultValue: props.fullName, tabIndex: 1,
        onChangeValueOk: (value, isOk) => this.updateValueOk('fullName', value, isOk) });

    // Show an "Or create a real account with username and password" button.
    const orCreateAccountMaybe = !isForGuest ? null :
        r.div({ className: 's_LD_OrCreateAccount' },
          t.cud.OrCreateAcct_1,
          r.a({ className: 's_LD_CreateAccount', onClick: this.props.switchBetweenGuestAndPassword },
            t.cud.OrCreateAcct_2),
          t.cud.OrCreateAcct_3,
          r.code({}, t.cud.OrCreateAcct_4),
          t.cud.OrCreateAcct_5);

    // For now, skip making it possible to change from create-account to login-as-guest.
    // People wouldn't find that text & button anyway? & in embedded comments, if guest
    // login is enabled, it's the default way to signup anyway, no need to switch. [8UKBTQ2]
     /* const orLoginAsGuestMaybe
          = isForGuest || this.props.loginReason === LoginReason.LoginToChat ? null :
        r.div({},  ... switch to guest login text & button ...); */

    const disableSubmit = _.includes(_.values(this.state.okayStatuses), false);

    return (
      r.form({ className: 'esCreateUser' },
        // When logging in as guest, the title is "Type our name:" and then better with name input first?
        isForGuest ? fullNameInput : null,
        emailInput,
        usernameInputMaybe,
        // Place the full name input above the password input, because someone thought
        // the full-name-input was a password verification field.
        !isForGuest ? fullNameInput : null,
        passwordInputMaybe,
        orCreateAccountMaybe,
        //orLoginAsGuestMaybe,
        PrimaryButton({ onClick: this.doCreateUser, disabled: disableSubmit, id: 'e2eSubmit',
            tabIndex: 2 }, isForGuest ? t.cud.LoginAsGuest : t.cud.CreateAccount)));
  }
});



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
        ModalBody({},
          // Use a <form>, so Enter key clicks the Continue button.
          r.form({ className: 'clearfix' },
            r.p({},
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
              onChange: (event) => this.setState({ accepts: event.target.checked }) }),

            // Keep inside the <form>, so Enter works. (Don't add a ModalFooter)
            Button({ onClick: this.close, className: 's_TermsD_B' + (accepts ? ' btn-primary' : '') },
              accepts ? t.Continue : t.Cancel)))));
  }
});



const CreateUserResultDialog = createComponent({
  displayName: 'CreateUserResultDialog',

  getInitialState: function () {
    return { isOpen: false };
  },
  sayVerifEmailSent: function(mayClose: boolean) {
    this.setState({ isOpen: true, checkEmail: true, isLoggedIn: false, mayClose });
  },
  sayWelcomeLoggedIn: function() {
    this.setState({ isOpen: true, checkEmail: false, isLoggedIn: true, mayClose: true });
  },
  close: function() {
    this.setState({ isOpen: false });
  },
  render: function () {
    const id = this.state.isLoggedIn ? 'te_WelcomeLoggedIn' : 'e2eNeedVerifyEmailDialog';
    const text = this.state.isLoggedIn ? t.cud.DoneLoggedIn : t.cud.AlmostDone;
    // Don't show a close-dialog button if there nothing on the page, after dialog closed.
    const footer = !this.state.mayClose || eds.isInLoginPopup ? null :
        ModalFooter({},
          PrimaryButton({ onClick: this.close }, t.Okay));
    return (
      Modal({ show: this.state.isOpen, onHide: this.state.mayClose ? this.close : null, id },
        // People don't read the dialog body, so let the title be "Check your email".
        ModalHeader({}, ModalTitle({}, this.state.checkEmail ? t.CheckYourEmail : t.Welcome)),
        ModalBody({}, r.p({}, text)),
        footer));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
