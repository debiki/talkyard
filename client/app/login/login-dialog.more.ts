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
/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/FullNameInput.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="create-user-dialog.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.login {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Modal = reactCreateFactory(ReactBootstrap.Modal);
var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);
var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
var FullNameInput = util.FullNameInput;
var EmailInput = util.EmailInput;

/* All login reasons?
  'LoginBecomeAdmin'
  'LoginAsAdmin'
  'LoginToAuthenticate'
  'LoginToSubmit'
  'LoginToComment'
  'LoginToLogin'
  'LoginToCreateTopic'
*/

var loginDialog;

// From before React.js.
var anyContinueAfterLoginCallback = null;


export function loginIfNeededReturnToAnchor(loginReason: LoginReason | string,
    anchor: string, success: () => void) {
  var returnToUrl = makeReturnToPageHashForVerifEmail(anchor);
  loginIfNeeded(loginReason, returnToUrl, success);
}


export function loginIfNeeded(loginReason: LoginReason | string, anyReturnToUrl?: string,
      success?: () => void) {
  success = success || function() {};
  if (debiki2.ReactStore.getUser().isLoggedIn) {
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


export function continueAfterLogin() {
  continueAfterLoginImpl();
}


export function getLoginDialog() {   // also called from Scala template
  if (!loginDialog) {
    loginDialog = ReactDOM.render(LoginDialog(), utils.makeMountNode());
  }
  return loginDialog;
}


var LoginDialog = createClassAndFactory({
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
    var newStore = debiki2.ReactStore.allData();
    this.setState({ store: newStore });
    var loggedInUser = newStore.me;
    if (loggedInUser) {
      // Might have just logged in in another tab. Then cancel any login happening in this tab.
      // Or, if we logged in in this tab, just close the dialog.
      anyContinueAfterLoginCallback = null;
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
    this.clearLoginRelatedCookies();
    if (!anyReturnToUrl) {
      anyReturnToUrl = window.location.toString();
    }
    if (d.i.isInIframe) {
      // UNTESTED after port to React
      var url = d.i.serverOrigin + '/-/login-popup?mode=' + loginReason +
          '&isInLoginPopup&returnToUrl=' + anyReturnToUrl;
      d.i.createLoginPopup(url)
    }
    else {
      anyContinueAfterLoginCallback = callback;
      this.setState({
        isOpen: true,
        isSignUp: isSignUp,
        loginReason: loginReason,
        anyReturnToUrl: anyReturnToUrl,
        preventClose: preventClose || loginReason === 'LoginToAuthenticate' ||
            loginReason === 'LoginToAdministrate',
        isLoggedIn: !!$['cookie']('dwCoSid'),
      });
    }
  },

  switchBetweenLoginAndSignUp: function() {
    this.setState({ isSignUp: !this.state.isSignUp });
  },

  /**
   * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
   */
  clearLoginRelatedCookies: function() {
    $['cookie']('dwCoReturnToUrl', null);
    $['cookie']('dwCoReturnToSite', null);
    $['cookie']('dwCoReturnToSiteXsrfToken', null);
    $['cookie']('dwCoIsInLoginWindow', null);
    $['cookie']('dwCoIsInLoginPopup', null);
    $['cookie']('dwCoMayCreateUser', null);
    $['cookie']('dwCoOAuth2State', null);
    $['cookie']('esCoImp', null);
  },

  close: function() {
    anyContinueAfterLoginCallback = null;
    this.setState({
      isOpen: false,
      loginReason: null,
      anyReturnToUrl: null,
      isLoggedIn: null,
    });
  },

  setChildDialog: function(childDialog) {
    this.setState({ childDialog: childDialog });
  },

  render: function () {
    var state = this.state;
    var fade = state.childDialog ? ' dw-modal-fade' : '';

    var title;
    switch (state.loginReason) {
      case 'LoginToAuthenticate':
        title = "Authentication required to access this site";
        break;
      case LoginReason.LoginToLike:
        title = "Login to Like this post";
        break;
      default:
        title = this.state.isSignUp ? "Create account" : "Log in";
    }

    var content = LoginDialogContent({ isSignUp: state.isSignUp, loginReason: state.loginReason,
        anyReturnToUrl: state.anyReturnToUrl, setChildDialog: this.setChildDialog,
        childDialog: state.childDialog, close: this.close, isLoggedIn: state.isLoggedIn,
        switchBetweenLoginAndSignUp: this.switchBetweenLoginAndSignUp,
        store: state.store });

    var modalHeader = state.loginReason === LoginReason.BecomeAdmin
      ? null // then there's an instruction text, that's enough
      : ModalHeader({ closeButton: !state.preventClose },
          ModalTitle({ id: 'e2eLoginDialogTitle' }, title));

    var modalFooter = state.preventClose ? ModalFooter({}) :
        ModalFooter({}, Button({ onClick: this.close, id: 'e2eLD_Cancel' }, "Cancel"));

    return (
      Modal({ show: state.isOpen, onHide: this.close, dialogClassName: 'dw-login-modal' + fade,
          keyboard: !state.childDialog && !state.preventClose,
          backdrop: state.preventClose ? 'static' : true },
        modalHeader,
        ModalBody({}, content),
        modalFooter));
  }
});


/**
 * This is a separate component because on embedded discussion pages, it's placed directly
 * in a popup window with no modal dialog around.
 */
export var LoginDialogContent = createClassAndFactory({
  displayName: 'LoginDialogContent',
  render: function() {
    var store: Store = this.props.store;
    var loginReason = this.props.loginReason;
    var isSignUp = this.props.isSignUp;

    var openChildDialog = (whichDialog) => {
      return (clickEvent) => {
        this.props.setChildDialog(whichDialog);
      }
    };

    var closeChildDialog = (closeAll) => {
      this.props.setChildDialog(null);
      if (closeAll === 'CloseAllLoginDialogs') {
        this.props.close();
      }
    };

    var childDialogProps = _.clone(this.props);
    childDialogProps.closeDialog = closeChildDialog;
    childDialogProps.createPasswordUser = true;

    var createChildDialog = (title, contentFactory, className?) => {
      var header = title ? ModalHeader({ closeButton: true }, ModalTitle({}, title)) : null;
      return (
        Modal({ show: this.props.childDialog === contentFactory, onHide: closeChildDialog,
            dialogClassName: className },
          header,
          ModalBody({}, contentFactory(childDialogProps))));
    };

    var createUserDialog = createChildDialog(null, CreateUserDialogContent, 'esCreateUserDlg');
    var passwordLoginDialog = createChildDialog("Login with Password", PasswordLoginDialogContent);
    var guestLoginDialog = createChildDialog("Login as Guest", GuestLoginDialogContent);

    var makeOauthProps = (iconClass: string, provider: string) => {
      return {
        id: 'e2eLogin' + provider,
        iconClass: iconClass,
        provider: provider,
        loginReason: loginReason,
        anyReturnToUrl: this.props.anyReturnToUrl,
      };
    };

    var becomeAdminInstructions = loginReason === LoginReason.BecomeAdmin
      ? r.div({ className: 'esLoginDlg_becomeAdminInstr' },
          r.p({},
            "Create admin account.", r.br(),
            "Use the email address you specified previously."))
      : null;

    var loggedInAlreadyInfo = this.props.isLoggedIn
        ? r.p({}, "You are logged in already, but you don't have access " +
            "to this part of the site. Please login below, as someone with access.")
        : null;

    var typePasswordForm = isSignUp ? null :
        PasswordLoginDialogContent(childDialogProps);

    var createUserForm = !isSignUp ? null :
        CreateUserDialogContent(childDialogProps);

    var loginAsGuestButton;
    if (loginReason !== LoginReason.BecomeAdmin && loginReason !== 'LoginAsAdmin' &&
        loginReason !== 'LoginToAdministrate' && loginReason !== 'LoginToAuthenticate' &&
        loginReason !== LoginReason.LoginToChat && !isSignUp &&
        debiki2.ReactStore.isGuestLoginAllowed()) {
      loginAsGuestButton =
          Button({ onClick: openChildDialog(GuestLoginDialogContent),
              className: 'esLoginDlg_guestBtn' }, "Login as Guest");
    }

    var termsAndPrivacy = loginReason === LoginReason.BecomeAdmin
      ? null // the owner doesn't need to agree to his/her own terms of use
      : r.p({ id: 'dw-lgi-tos' },
          (isSignUp ? "By proceeding" : "By logging in") +
          ", you agree to our ", r.a({ href: "/-/terms-of-use" }, "Terms of Use"),
          " and ", r.a({ href: '/-/privacy-policy' }, "Privacy Policy"));

    var switchToOtherDialogInstead;
    if (isSignUp) {
      switchToOtherDialogInstead =
        r.div({ className: 'form-group esLD_Switch' },
          "(", r.i({}, "Already have an account? ",
            r.a({ className: 'esLD_Switch_L', onClick: this.props.switchBetweenLoginAndSignUp },
              "Login"),
            " instead"), " )");
    }
    else if (store.siteStatus > SiteStatus.Active) {
      // Right now, don't allow creation of new accounts, for deactivated sites. Later, though,
      // let admins invite new staff, if the site is in ReadAndCleanOnly mode. [5PY8FD2]
      // BUG currently no store data is included on /-/login, so even if siteStatus > Active,
      // the "Create account" link inserted below (in `else`) will be added, nevertheless.
      // SHOULD include store data also in app/views/login/popupMain.scala.html [4PKF02T]
    }
    else {
      // The login dialog opens not only via the Log In button, but also if one clicks
      // e.g. Create Topic. So it's important to be able to switch to sign-up.
      switchToOtherDialogInstead =
        r.div({ className: 'form-group esLD_Switch' },
          "(", r.i({}, "New user? ",
          r.a({ className: 'esLD_Switch_L', onClick: this.props.switchBetweenLoginAndSignUp },
            "Create account"),
          " instead"), " )");
    }

    return (
      r.div({ className: 'esLD' },
        createUserDialog,
        passwordLoginDialog,
        guestLoginDialog,
        loggedInAlreadyInfo,
        becomeAdminInstructions,
        termsAndPrivacy,
        r.p({ id: 'dw-lgi-or-login-using' },
          isSignUp ? "Create account with:" : "Login with:"),
        r.div({ id: 'dw-lgi-other-sites' },
          OpenAuthButton(makeOauthProps('icon-google-plus', 'Google')),
          OpenAuthButton(makeOauthProps('icon-facebook', 'Facebook')),
          OpenAuthButton(makeOauthProps('icon-twitter', 'Twitter')),
          OpenAuthButton(makeOauthProps('icon-github', 'GitHub')),
          // OpenID doesn't work right now, skip for now:  icon-yahoo Yahoo!
          loginAsGuestButton),

        r.p({ id: 'dw-lgi-or-login-using' },
          isSignUp
              ? "Or create an account here:"
              : "Or fill in:"),

        switchToOtherDialogInstead,
        typePasswordForm,
        createUserForm));
  }
});


var OpenAuthButton = createClassAndFactory({
  displayName: 'OpenAuthButton',
  onClick: function() {
    var props = this.props;
    // Any new user wouldn't be granted access to the admin page, so don't allow
    // creation of  new users from here.
    // (This parameter tells the server to set a certain cookie. Setting it here
    // instead has no effect, don't know why.)
    var mayNotCreateUser = props.loginReason === 'LoginToAdministrate' ? 'mayNotCreateUser&' : '';
    var url = d.i.serverOrigin +
        '/-/login-openauth/' + props.provider.toLowerCase() +
        '?' + mayNotCreateUser +
        (d.i.isInLoginWindow ? '' : 'isInLoginPopup&') +
        'returnToUrl=' + (props.anyReturnToUrl || '');
    if (d.i.isInLoginWindow) {
      // Let the server know we're in a login window, so it can choose to reply with
      // complete HTML pages to show in the popup window.
      // (Use a cookie not an URL param because the cookie will be present later whe we're
      // being redirected back to the server from the OpenAuth provider.)
      $['cookie']('dwCoIsInLoginWindow', 'true');
      window.location.assign(url);
    }
    else {
      d.i.createLoginPopup(url);
    }
  },
  render: function() {
    return (
      Button({ id: this.props.id, className: this.props.iconClass, onClick: this.onClick },
        this.props.provider ));
  }
});


// Later, create some OpenId button too? Old LiveScript code:
/**
 * Logs in at Yahoo by submitting an OpenID login form in a popup.
 * /
function submitOpenIdLoginForm(openidIdentifier)
  form = $("""
    <form action="#{d.i.serverOrigin}/-/api/login-openid" method="POST">
      <input type="text" name="openid_identifier" value="#openidIdentifier">
    </form>
    """)
  # Submit form in a new login popup window, unless we already are in a login window.
  if d.i.isInLoginWindow
    $('body').append(form)
  else
    d.i.createOpenIdLoginPopup(form)
  form.submit()
  false */


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
          "Login" + inOrderTo(this.props.loginReason)),
        Button({ onClick: this.props.closeDialog, className: 'e_LD_G_Cancel' }, "Cancel")));
  }
});


var PasswordLoginDialogContent = createClassAndFactory({
  displayName: 'PasswordLoginDialogContent',

  getInitialState: function() {
    return {};
  },

  doLogin: function() {
    var emailOrUsername = this.refs.whoInput.getValue();
    var password = this.refs.passwordInput.getValue();
    Server.loginWithPassword(emailOrUsername, password, () => {
      continueAfterLoginImpl(this.props.anyReturnToUrl);
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
    var hideClass = this.state.hideBadPasswordMessage ? ' esHidden' : '';
    var badPasswordMessage = !this.state.badPassword ? null :
        r.div({ className: 'esLoginDlg_badPwd' + hideClass },
          r.b({}, "Wrong username or password"));

    return (
      r.form({},
        Input({ type: 'text', label: "Username or email:", ref: 'whoInput',
            onChange: this.clearError, id: 'e2eUsername' }),
        Input({ type: 'password', label: "Password:", ref: 'passwordInput',
            onChange: this.clearError, id: 'e2ePassword' }),
        badPasswordMessage,
        PrimaryButton({ onClick: this.doLogin, id: 'e2eSubmit' },
          "Login" + inOrderTo(this.props.loginReason)),
        r.br(),
        r.a({ href: debiki.internal.serverOrigin + '/-/reset-password/specify-email',
            // Once the password has been reset, the user will be logged in automatically. Then
            // it's confusing if this dialog is still open, so close it on click. [5KWE02X]
            // UX COULD show reset-pwd input in a dialog directly here instead, don't want it
            // on a separate page.
            onClick: () => this.props.closeDialog('CloseAllLoginDialogs'),
            target: '_blank', className: 'dw-reset-pswd',
            style: { marginTop: '1ex', display: 'inline-block' }},
          "Did you forget your password?")));
  }
});


/**
 * Text to append to the login button so it reads e.g. "Login to write a comment".
 */
function inOrderTo(loginReason: string): string {
  switch (loginReason) {
    case 'LoginToSubmit': return " and submit";
    case 'LoginToComment': return " to write a comment";
    case 'LoginToCreateTopic': return " to create topic";
    default: return "";
  }
}


function continueAfterLoginImpl(anyReturnToUrl?: string) {
  if (debiki.internal.isInLoginWindow) {
    // We're in an admin section login page, or an embedded comments page login popup window.
    if (anyReturnToUrl && anyReturnToUrl.indexOf('_RedirFromVerifEmailOnly_') === -1) {
      window.location.assign(anyReturnToUrl);
    }
    else {
      // (Also see LoginWithOpenIdController, search for [509KEF31].)
      window.opener['debiki'].internal.handleLoginResponse({ status: 'LoginOk' });
      // This should be a login popup. Close the whole popup window.
      close();
    }
  }
  else {
    // We're on a normal page (but not in a login popup window for an embedded comments page).
    // (The login dialogs close themselves when the login event gets fired.)
    debiki2.ReactActions.loadMyself(anyContinueAfterLoginCallback);
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
