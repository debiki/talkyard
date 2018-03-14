/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/FullNameInput.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="create-user-dialog.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.login {
//------------------------------------------------------------------------------

const d = { i: debiki.internal, u: debiki.v0.util };
const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const FullNameInput = util.FullNameInput;
const EmailInput = util.EmailInput;

/* All login reasons? — no, there're more now, right.
  'LoginBecomeAdmin'
  'LoginAsAdmin'
  'LoginToAuthenticate'
  'LoginToSubmit'
  'LoginToComment'
  'LoginToLogin'
  'LoginToCreateTopic'
*/

let loginDialog;


export function loginIfNeeded(loginReason: LoginReason | string, anyReturnToUrl?: string,
      success?: () => void) {
  success = success || function() {};
  if (debiki2.ReactStore.getMe().isLoggedIn) {
    success();
  }
  else {
    if (loginReason === LoginReason.SignUp) {
      getLoginDialog().openToSignUp(loginReason, anyReturnToUrl, success);
    }
    else {
      getLoginDialog().openToLogIn(loginReason, anyReturnToUrl, success);
    }
  }
}


export function getLoginDialog() {   // also called from Scala template
  if (!loginDialog) {
    loginDialog = ReactDOM.render(LoginDialog(), utils.makeMountNode());
  }
  return loginDialog;
}


const LoginDialog = createClassAndFactory({
  displayName: 'LoginDialog',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      childDialog: null,
      logInOrSignUp: null,
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    const newStore: Store = debiki2.ReactStore.allData();
    this.setState({ store: newStore });
    const loggedInUser = newStore.me;
    if (loggedInUser) {
      // Might have just logged in in another tab. Then cancel any login happening in this tab.
      // Or, if we logged in in this tab, just close the dialog.
      login.anyContinueAfterLoginCallback = null;
      this.setState({
        isOpen: false,
        childDialog: null
      });
    }
  },

  openToLogIn: function(loginReason: LoginReason | string,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {
    this.open(false, loginReason, anyReturnToUrl, callback, preventClose);
  },

  openToSignUp: function(loginReason: LoginReason | string,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {
    this.open(true, loginReason, anyReturnToUrl, callback, preventClose);
  },

  open: function(isSignUp: boolean, loginReason: LoginReason | string,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {

    dieIf(eds.isInIframe, 'Login dialog in iframe [EdE5KER2]');

    // Don't allow logging in as someone else, when impersonating someone, because it's unclear
    // what should then happen: does one stop impersonating? or not?
    if (getSetCookie('esCoImp')) {
      util.openDefaultStupidDialog({
        preventClose: true,
        body: r.div({},
          r.p({}, t.ld.NotFoundOrPrivate),
          r.p({}, t.ld.IsImpersonating)) });
      return;
    }

    this.clearLoginRelatedCookies();
    if (!anyReturnToUrl) {
      anyReturnToUrl = window.location.toString();
    }

    login.anyContinueAfterLoginCallback = callback;
    this.setState({
        isOpen: true,
        isSignUp: isSignUp,
        loginReason: loginReason,
        afterLoginCallback: callback,
        anyReturnToUrl: anyReturnToUrl,
        preventClose: preventClose || loginReason === 'LoginToAuthenticate' ||
            loginReason === 'LoginToAdministrate',
        isLoggedIn: !!getSetCookie('dwCoSid'),
      });
  },

  getAfterLoginCallback: function() {
    return this.state.afterLoginCallback;
  },

  switchBetweenLoginAndSignUp: function() {
    this.setState({ isSignUp: !this.state.isSignUp });
  },

  /**
   * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
   */
  clearLoginRelatedCookies: function() {
    getSetCookie('dwCoReturnToUrl', null);
    getSetCookie('dwCoReturnToSite', null);
    getSetCookie('dwCoReturnToSiteXsrfToken', null);
    getSetCookie('dwCoIsInLoginWindow', null);
    getSetCookie('dwCoIsInLoginPopup', null);
    getSetCookie('dwCoMayCreateUser', null);
    getSetCookie('dwCoOAuth2State', null);
    getSetCookie('esCoImp', null);
  },

  close: function() {
    login.anyContinueAfterLoginCallback = null;
    this.setState({
      isOpen: false,
      loginReason: null,
      afterLoginCallback: null,
      anyReturnToUrl: null,
      isLoggedIn: null,
    });
  },

  setChildDialog: function(childDialog) {
    this.setState({ childDialog: childDialog });
  },

  render: function () {
    const state = this.state;
    const fade = state.childDialog ? ' dw-modal-fade' : '';

    let title;
    switch (state.loginReason) {
      case 'LoginToAuthenticate':
        title = t.ld.AuthRequired;
        break;
      case LoginReason.LoginToLike:
        title = t.ld.LoginToLike;
        break;
      default:
        title = this.state.isSignUp ? t.ld.CreateAcconut : t.ld.LogIn;
    }

    const content = LoginDialogContent({ isSignUp: state.isSignUp, loginReason: state.loginReason,
        anyReturnToUrl: state.anyReturnToUrl, afterLoginCallback: state.afterLoginCallback,
        setChildDialog: this.setChildDialog,
        childDialog: state.childDialog, close: this.close, isLoggedIn: state.isLoggedIn,
        switchBetweenLoginAndSignUp: this.switchBetweenLoginAndSignUp,
        store: state.store });

    /* UX SHOULD show this close [x] in 'content' instead, so can be closed easily.
    var modalHeader = state.loginReason === LoginReason.BecomeAdmin
      ? null // then there's an instruction text, that's enough
      : ModalHeader({ closeButton: !state.preventClose },
          ModalTitle({ id: 'e2eLoginDialogTitle' }, title));
    */

    const modalFooter = state.preventClose ? ModalFooter({}) :
        ModalFooter({}, Button({ onClick: this.close, id: 'e2eLD_Cancel', tabIndex: 3 }, t.Cancel));

    return (
      Modal({ show: state.isOpen, onHide: this.close, dialogClassName: 'dw-login-modal' + fade,
          keyboard: !state.childDialog && !state.preventClose,
          backdrop: state.preventClose ? 'static' : true },
        ModalBody({}, content),
        modalFooter));
  }
});


/**
 * This is a separate component because on embedded discussion pages, it's placed directly
 * in a popup window with no modal dialog around.
 */
export const LoginDialogContent = createClassAndFactory({
  displayName: 'LoginDialogContent',
  render: function() {
    const store: Store = this.props.store;
    const loginReason = this.props.loginReason;
    const isSignUp = this.props.isSignUp;

    const openChildDialog = (whichDialog) => {
      return (clickEvent) => {
        this.props.setChildDialog(whichDialog);
      }
    };

    const closeChildDialog = (closeAll) => {
      this.props.setChildDialog(null);
      if (closeAll === 'CloseAllLoginDialogs') {
        this.props.close();
      }
    };

    const childDialogProps = _.clone(this.props);
    childDialogProps.closeDialog = closeChildDialog;
    childDialogProps.createPasswordUser = true;

    const createChildDialog = (title, contentFactory, className?) => {
      const header = title ? ModalHeader({ closeButton: true }, ModalTitle({}, title)) : null;
      return (
        Modal({ show: this.props.childDialog === contentFactory, onHide: closeChildDialog,
            dialogClassName: className },
          header,
          ModalBody({}, contentFactory(childDialogProps))));
    };

    const createUserDialog = createChildDialog(null, CreateUserDialogContent, 'esCreateUserDlg');
    const passwordLoginDialog = createChildDialog(t.ld.LogInWithPwd, PasswordLoginDialogContent);
    var guestLoginDialog; // no. CLEAN_UP, remove: createChildDialog("Log in as Guest", GuestLoginDialogContent);

    const makeOauthProps = (iconClass: string, provider: string, includeWith?: boolean) => {
      return {
        inclWith: includeWith,
        id: 'e2eLogin' + provider,
        iconClass: iconClass,
        provider: provider,
        loginReason: loginReason,
        anyReturnToUrl: this.props.anyReturnToUrl,
      };
    };

    const isForFirstOwner = loginReason === LoginReason.BecomeAdmin;
    const becomeOwnerInstructions = !isForFirstOwner ? null :
        r.div({ className: 'esLoginDlg_becomeAdminInstr' },
          r.p({},
            // Say "admin" not "owner" here — simpler to understand, and first owner is admin too.
            t.ld.CreateAdmAcct));
            // UX SHOULD add back, for first site: "Use the email address you specified in the config file."));


    const notFound = loginReason === 'LoginBecauseNotFound';
    const notFoundInstructions = !notFound ? null :
        r.div({ className: 'esLoginDlg_becomeAdminInstr' },
          r.h1({ className: 's_LD_NotFound_Title' }, t.ld.NotFoundOrPrivate),
          r.p({ className: 's_LD_NotFound_Details' },
            t.ld.IfYouThinkExistsThen +
            (this.props.isLoggedIn ? t.ld.LoggedInAlready : '') +
            t.ld.ElseGoToHome_1, r.a({ className: 's_LD_NotFound_HomeL', href: '/' },
              t.ld.ElseGoToHome_2)));

    const typePasswordForm = isSignUp ? null :
        PasswordLoginDialogContent(childDialogProps);

    const createUserForm = !isSignUp ? null :
        CreateUserDialogContent(childDialogProps);

    var loginAsGuestButton; /* CLEAN_UP, + more login-as-guest dialogs & stuff?
    if (loginReason !== LoginReason.BecomeAdmin && loginReason !== 'LoginAsAdmin' &&
        loginReason !== 'LoginToAdministrate' && loginReason !== 'LoginToAuthenticate' &&
        loginReason !== LoginReason.LoginToChat && !isSignUp &&
        debiki2.ReactStore.isGuestLoginAllowed()) {
      loginAsGuestButton =
          Button({ onClick: openChildDialog(GuestLoginDialogContent),
              className: 'esLoginDlg_guestBtn' }, "Log in as Guest");
    } */

    let switchToOtherDialogInstead;
    if (isForFirstOwner) {
      // Don't show any switch-between-login-and-signup buttons.
    }
    else if (isSignUp) {
      switchToOtherDialogInstead =
        r.div({ className: 'form-group esLD_Switch' },
          "(", r.i({}, t.ld.AlreadyHaveAcctQ,
            t.ld.LoginInstead_1,
            r.a({ className: 'esLD_Switch_L', onClick: this.props.switchBetweenLoginAndSignUp },
              t.ld.LoginInstead_2),
            t.ld.LoginInstead_3), " )");
    }
    else if (store.siteStatus > SiteStatus.Active) {
      // Right now, don't allow creation of new accounts, for deactivated sites. Later, though,
      // let admins invite new staff, if the site is in ReadAndCleanOnly mode. [5PY8FD2]
      // BUG currently no store data is included on /-/login, so even if siteStatus > Active,
      // the "Create account" link inserted below (in `else`) will be added, nevertheless.
    }
    else {
      // The login dialog opens not only via the Log In button, but also if one clicks
      // e.g. Create Topic. So it's important to be able to switch to sign-up.
      switchToOtherDialogInstead =
        r.div({ className: 'form-group esLD_Switch' },
          "(", r.i({}, t.ld.NewUserQ,
          t.ld.SignUpInstead_1,
          r.a({ className: 'esLD_Switch_L', onClick: this.props.switchBetweenLoginAndSignUp },
            t.ld.SignUpInstead_2),
          t.ld.SignUpInstead_3), " )");
    }

    return (
      r.div({ className: 'esLD' },
        createUserDialog,
        passwordLoginDialog,
        notFoundInstructions,
        becomeOwnerInstructions,
        r.p({ id: 'dw-lgi-or-login-using' }, (isSignUp ? t.ld.SignIn : t.ld.LogIn) + ' ...'),
        r.div({ id: 'dw-lgi-other-sites' },
          OpenAuthButton(makeOauthProps('icon-google', 'Google', true)),
          OpenAuthButton(makeOauthProps('icon-facebook', 'Facebook')),
          OpenAuthButton(makeOauthProps('icon-twitter', 'Twitter')),
          OpenAuthButton(makeOauthProps('icon-github-circled', 'GitHub')),
          // OpenID doesn't work right now, skip for now:  icon-yahoo Yahoo!
          loginAsGuestButton),

        r.p({ id: 'dw-lgi-or-login-using' },
          isSignUp
              ? t.ld.OrCreateAcctHere
              : t.ld.OrFillin),

        switchToOtherDialogInstead,
        typePasswordForm,
        createUserForm));
  }
});


const OpenAuthButton = createClassAndFactory({
  displayName: 'OpenAuthButton',
  onClick: function() {
    const props = this.props;
    // Any new user wouldn't be granted access to the admin page, so don't allow
    // creation of  new users from here.
    // (This parameter tells the server to set a certain cookie. Setting it here
    // instead has no effect, don't know why.)
    const mayNotCreateUser = props.loginReason === 'LoginToAdministrate' ? 'mayNotCreateUser&' : '';
    const url = eds.serverOrigin +
        '/-/login-openauth/' + props.provider.toLowerCase() +
        '?' + mayNotCreateUser +
        (eds.isInLoginWindow ? '' : 'isInLoginPopup&') +
        'returnToUrl=' + (props.anyReturnToUrl || '');
    if (eds.isInLoginWindow) {
      // Let the server know we're in a login window, so it can choose to reply with
      // complete HTML pages to show in the login window.
      // (Use a cookie not an URL param because the cookie will be present later whe we're
      // being redirected back to the server from the OpenAuth provider.)
      getSetCookie('dwCoIsInLoginWindow', 'true');
      window.location.assign(url);
    }
    else {
      d.i.createLoginPopup(url);
    }
  },
  render: function() {
    return (
      Button({ id: this.props.id, className: this.props.iconClass, onClick: this.onClick },
        (this.props.inclWith ? "with " : "") + this.props.provider ));
  }
});


// Later, create some OpenId button too? Old LiveScript code:  CLEAN_UP REMOVE
/**
 * Logs in at Yahoo by submitting an OpenID login form in a popup.
 * /
function submitOpenIdLoginForm(openidIdentifier)
  form = $("""
    <form action="#{eds.serverOrigin}/-/api/login-openid" method="POST">
      <input type="text" name="openid_identifier" value="#openidIdentifier">
    </form>
    """)
  # Submit form in a new login popup window, unless we already are in a login window.
  if eds.isInLoginWindow
    $('body').append(form)
  else
    d.i.createOpenIdLoginPopup(form)
  form.submit()
  false */

/*  CLEAN_UP REMOVE
var GuestLoginDialogContent = createClassAndFactory({
  displayName: 'GuestLoginDialogContent',
  getInitialState: function() {
    return {
      okayStatuses: {
        fullName: false,  // because: required
        email: true  // because: not required
      },
    };
  },

  updateValueOk: function(what, value, isOk) {
    this.state.okayStatuses[what] = isOk; // updating in place, oh well
    this.setState(this.state);
  },

  doLogin: function() {
    var name = this.refs.nameInput.getValue();
    var email = this.refs.emailInput.getValue();
    Server.loginAsGuest(name, email, () => {
      continueAfterLoginImpl(this.props.anyReturnToUrl);
    });
  },

  render: function() {
    var disableSubmit = _.includes(_.values(this.state.okayStatuses), false);
    return (
      r.form({},
        FullNameInput({ type: 'text', label: "Your name:", ref: 'nameInput', id: 'e2eLD_G_Name',
            onChangeValueOk: (value, isOk) => this.updateValueOk('fullName', value, isOk) }),
        EmailInput({ label: "Email: (optional, not shown)", ref: 'emailInput', required: false,
            help: "If you want to be notified about replies to your comments.", id: 'e2eLD_G_Email',
            onChangeValueOk: (value, isOk) => this.updateValueOk('email', value, isOk) }),
        Button({ onClick: this.doLogin, disabled: disableSubmit, id: 'e2eLD_G_Submit' },
          "Log in" + inOrderTo(this.props.loginReason)),
        Button({ onClick: this.props.closeDialog, className: 'e_LD_G_Cancel' }, "Cancel")));
  }
}); */


const PasswordLoginDialogContent = createClassAndFactory({
  displayName: 'PasswordLoginDialogContent',

  getInitialState: function() {
    return {};
  },

  doLogin: function() {
    const emailOrUsername = this.refs.whoInput.getValue();
    const password = this.refs.passwordInput.getValue();
    Server.loginWithPassword(emailOrUsername, password, () => {
      login.continueAfterLogin(this.props.anyReturnToUrl);
    }, () => {
      this.setState({ badPassword: true, hideBadPasswordMessage: false });
      this.refs.passwordInput.getInputDOMNode().focus();
    });
  },

  clearError: function() {
    if (this.state.badPassword) {
      this.setState({ hideBadPasswordMessage: true });
    }
  },

  render: function() {
    const hideClass = this.state.hideBadPasswordMessage ? ' esHidden' : '';
    const badPasswordMessage = !this.state.badPassword ? null :
        r.div({ className: 'esLoginDlg_badPwd' + hideClass },
          r.b({}, t.ld.BadCreds));

    return (
      r.form({},
        Input({ type: 'text', label: t.ld.UsernameOrEmailC, ref: 'whoInput',
            onChange: this.clearError, id: 'e2eUsername' }),
        Input({ type: 'password', label: t.ld.PasswordC, ref: 'passwordInput',
            onChange: this.clearError, id: 'e2ePassword' }),
        badPasswordMessage,
        PrimaryButton({ onClick: this.doLogin, id: 'e2eSubmit' },
          loginToWhat(this.props.loginReason)),
        r.br(),
        r.a({ href: eds.serverOrigin + '/-/reset-password/specify-email',
            // Once the password has been reset, the user will be logged in automatically. Then
            // it's confusing if this dialog is still open, so close it on click. [5KWE02X]
            // UX COULD show reset-pwd input in a dialog directly here instead, don't want it
            // on a separate page.
            onClick: () => this.props.closeDialog('CloseAllLoginDialogs'),
            target: '_blank', className: 'dw-reset-pswd',
            style: { marginTop: '1ex', display: 'inline-block' }},
          t.ld.ForgotPwd)));
  }
});


/**
 * Text to append to the login button so it reads e.g. "Log in to write a comment".
 */
function loginToWhat(loginReason: string): string {
  switch (loginReason) {
    case 'LoginToSubmit': return t.ld.LoginToSubmit;
    case 'LoginToComment': return t.ld.LoginToComment;
    case 'LoginToCreateTopic': return t.ld.LoginToCreateTopic;
    default: return "";
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
