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

/// <reference path="../more-prelude.more.ts" />
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
  LoginReason.PostEmbeddedComment
  'LoginToLogin'
  'LoginToCreateTopic'
*/

let loginDialog;


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
      logInOrSignUp: null,  // CLEAN_UP REMOVE
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

  // Called from Scala template.
  openToSignUp: function(loginReason: LoginReason | string,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {
    // CLEAN_UP replace openToLogIn and openToSignUp with just one open(loginReason, ..) that
    // decides if to log in or sig up? For now:
    const reallySignup = loginReason !== 'LoginToAdministrate';
    this.open(reallySignup, loginReason, anyReturnToUrl, callback, preventClose);
  },

  open: function(isSignUp: boolean, loginReason: LoginReason | string,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {

    dieIf(isInSomeEmbCommentsIframe(), 'Login dialog in some emb cmnts iframe [EdE5KER2]');
    const store: Store = this.state.store;

    // The login reason might be a stringified number from the url, so try to convert to enum.
    // Some login reasons are enums, others are strings. CLEAN_UP: Change the strings to enums.
    loginReason = _.isString(loginReason) ? parseInt(loginReason) || loginReason : loginReason;

    // Don't allow logging in as someone else, when impersonating someone, because it's unclear
    // what should then happen: does one stop impersonating? or not?
    if (getSetCookie('esCoImp')) {
      util.openDefaultStupidDialog({
        preventClose: true,
        body: r.div({},
          r.p({ className: 'e_ImpFrbdn' }, t.ld.NotFoundOrPrivate),
          r.p({}, t.ld.IsImpersonating),
          // If clicking Back would take us to the Admin Area, hide that button
          // — because if browser-Back-going there whilst impersonating someone,
          // the admin area looks half broken — harmless but looks weird.
          // (Is checking document.referrer here anti-React [ANTI_REACT] style? Fine, harmless.)
          document.referrer.indexOf(AdminRoot) >= 0 ? null :
            Button({ onClick: () => history.back(), className: 'e_ImpBackB' },
              "Go back"),
          Button({ onClick: Server.stopImpersonatingReloadPage, className: 'e_ImpStopB' },
            // dupl text [306MKTW33]
            store.isViewingAs ? "Stop viewing as other" : "Stop impersonating"),
          ) });
      return;
    }

    this.clearLoginRelatedCookies();
    if (!anyReturnToUrl) {
      anyReturnToUrl = window.location.toString();
    }

    login.anyContinueAfterLoginCallback = callback;

    if (store.settings.allowSignup === false)
      isSignUp = false;

    // When logging in to an embedded comments discussion, if guest login is enabled,
    // then assume that's what most people want to use. [8UKBTQ2]
    const isForGuest = isSignUp && loginReason === LoginReason.PostEmbeddedComment &&
        store.settings.allowGuestLogin;

    this.setState({
        isOpen: true,
        isSignUp,
        isForGuest,
        loginReason,
        afterLoginCallback: callback,
        anyReturnToUrl,
        preventClose: preventClose || loginReason === 'LoginToAuthenticate' ||
            loginReason === 'LoginToAdministrate',
        isLoggedIn: !!getSetCookie('dwCoSid'),
      });
  },

  getAfterLoginCallback: function() {
    return this.state.afterLoginCallback;
  },

  switchBetweenLoginAndSignUp: function() {
    // Don't switch back to guest login, after a "sign up instead" click
    // — that'd be confusing? Guest login is no real signup.
    this.setState({ isSignUp: !this.state.isSignUp, isForGuest: false });
  },

  switchBetweenGuestAndPassword: function() {
    this.setState({ isForGuest: !this.state.isForGuest });
  },

  /**
   * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
   */
  clearLoginRelatedCookies: function() {
    getSetCookie('dwCoReturnToUrl', null);
    getSetCookie('dwCoReturnToSite', null);
    // Don't clear dwCoReturnToSiteXsrfToken — that'd break parallel login, [PRLGIN]
    // and break OAuth login if opens the login dialog, clicks "Google" to open a Google
    // login popup, then closes and reopens the login dialog, and then logs in at Google
    // in the popup.
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
        title = t.ld.LogInToLike;
        break;
      default:
        title = this.state.isSignUp ? t.ld.CreateAcconut : t.ld.LogIn;
    }

    const content = LoginDialogContent({
        isSignUp: state.isSignUp, isForGuest: state.isForGuest, loginReason: state.loginReason,
        anyReturnToUrl: state.anyReturnToUrl, afterLoginCallback: state.afterLoginCallback,
        setChildDialog: this.setChildDialog,
        childDialog: state.childDialog, close: this.close, isLoggedIn: state.isLoggedIn,
        switchBetweenLoginAndSignUp: this.switchBetweenLoginAndSignUp,
        switchBetweenGuestAndPassword: this.switchBetweenGuestAndPassword,
        store: state.store });

    /* UX SHOULD show this close [x] in 'content' instead, so can be closed easily.
    var modalHeader = state.loginReason === LoginReason.BecomeAdmin
      ? null // then there's an instruction text, that's enough
      : ModalHeader({ closeButton: !state.preventClose },
          ModalTitle({ id: 'e2eLoginDialogTitle' }, title));
    */

    const modalFooter = state.preventClose ? null :
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

  componentDidMount: function() {
    const store: Store = this.props.store;
    const settings: SettingsVisibleClientSide = store.settings;

    // Redirect directly to any SSO page, if 1) SSO enabled and 2) login is required,
    // and 3) a [navigate elsewhere after logout] url has been configured (to avoid
    // possibly instant login after logout),
    // so one won't see an empty page with just a "Log In" button (the .s_LD_SsoB button).
    // This redirect could be done server side, here: [COULDSSOREDIR]. However, then
    // makeSsoUrl() would need to be available server side too.
    if (settings.effectiveSsoLoginRequiredLogoutUrl) {
      const ssoUrl = makeSsoUrl(store, location.toString());
      location.assign(ssoUrl);
    }
  },

  render: function() {
    const store: Store = this.props.store;
    const loginReason = this.props.loginReason;
    const isSignUp = this.props.isSignUp;
    const settings: SettingsVisibleClientSide = store.settings;

    const closeChildDialog = (closeAll) => {
      this.props.setChildDialog(null);
      if (closeAll === 'CloseAllLoginDialogs') {
        this.props.close();
      }
    };

    const childDialogProps = _.clone(this.props);
    childDialogProps.closeDialog = closeChildDialog;  // CLEAN_UP can REMOVE?

    const makeOauthProps = (iconClass: string, provider: string, content?) => {
      return {
        id: 'e2eLogin' + provider,
        iconClass: iconClass,
        provider: provider,
        loginReason: loginReason,
        anyReturnToUrl: this.props.anyReturnToUrl,
        content
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

    const loginForm = isSignUp ? null :
        PasswordLoginDialogContent(childDialogProps);

    const isForGuest = this.props.isForGuest;
    const isForPasswordUser = !isForGuest;
    const createUserForm = !isSignUp || settings.allowLocalSignup === false ? null :
        CreateUserDialogContent({ ...childDialogProps, isForPasswordUser, isForGuest });

    let switchToOtherDialogInstead;
    if (isForFirstOwner) {
      // Don't show any switch-between-login-and-signup buttons.
    }
    else if (isSignUp) {
      // If no signup fields above, center align the "Or log in instead" text, else looks weird.
      const style = settings.allowLocalSignup === false ? { textAlign: 'center' } : null;
      switchToOtherDialogInstead =
        r.div({ className: 'form-group esLD_Switch', style },
          "(", r.i({}, t.ld.AlreadyHaveAcctQ,
            t.ld.LogInInstead_1,
            r.a({ className: 'esLD_Switch_L', onClick: this.props.switchBetweenLoginAndSignUp },
              t.ld.LogInInstead_2),
            t.ld.LogInInstead_3), " )");
    }
    else if (store.siteStatus > SiteStatus.Active) {
      // Right now, don't allow creation of new accounts, for deactivated sites. Later, though,
      // let admins invite new staff, if the site is in ReadAndCleanOnly mode. [5PY8FD2]
      // BUG currently no store data is included on /-/login, so even if siteStatus > Active,
      // the "Create account" link inserted below (in `else`) will be added, nevertheless.
    }
    else if (settings.allowSignup === false) {
      // Then don't show any switch-to-signup button.
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

    const ss = store.settings;

    const anyOpenAuth = ss.enableGoogleLogin || ss.enableFacebookLogin ||
        ss.enableTwitterLogin || ss.enableGitHubLogin || ss.enableLinkedInLogin;

    let content;
    if (settings.enableSso) {
      const ssoUrl = makeSsoUrl(store, location.toString());
      content =
          r.div({ style: { textAlign: 'center' }},
            ExtLinkButton({ href: ssoUrl, className: 's_LD_SsoB btn-primary' },
              "Log In"));
    }
    else {
      content = rFragment({},
        becomeOwnerInstructions,
        !anyOpenAuth ? null : rFragment({},
          r.p({ id: 'dw-lgi-or-login-using' },
            // "Continue with" converts better than "Sign Up" or "Log In", says
            // Facebook's brand guidelines.
            t.ld.ContinueWithDots),
          r.div({ id: 'dw-lgi-other-sites' },
            !ss.enableGoogleLogin ? null :
                OpenAuthButton(makeOauthProps('icon-google', 'Google')),
            !ss.enableFacebookLogin ? null :
                OpenAuthButton(makeOauthProps('icon-facebook', 'Facebook', rFragment({},
                  // Need to follow Facebook's brand guidelines. [FBBRAND]
                  FacebookLogoImage, "Facebook"))),
            !ss.enableTwitterLogin ? null :
                OpenAuthButton(makeOauthProps('icon-twitter', 'Twitter')),
            !ss.enableGitHubLogin ? null :
                OpenAuthButton(makeOauthProps('icon-github-circled', 'GitHub')),
            !ss.enableLinkedInLogin ? null :
                OpenAuthButton(makeOauthProps('icon-linkedin', 'LinkedIn')),
            // OpenID doesn't work right now, skip for now:  icon-yahoo Yahoo!
            )),

        isSignUp && ss.allowLocalSignup === false ? null : (
          r.p({ id: 'dw-lgi-or-login-using' },
            anyOpenAuth
              ? (isSignUp
                  ? (isForGuest ? t.ld.OrTypeName : t.ld.OrCreateAcctHere)
                  : t.ld.OrLogIn)
              : (isSignUp
                  ? (isForGuest ? t.ld.YourNameQ : t.ld.SignUp)
                  : t.ld.LogIn))),

        switchToOtherDialogInstead,
        loginForm,
        createUserForm);
    }

    return (
      r.div({ className: 'esLD' },
        notFoundInstructions,
        content));
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
    const url = origin() +
        '/-/login-openauth/' + props.provider.toLowerCase() +
        '?' + mayNotCreateUser +
        // If we are already in a dedicated full screen login window, the server should
        // redirect us inside this window to where we want to go after login.
        // If instead this is just a login popup win, the server wants to know about that —
        // it'll then instead return a html page that runs some javascript that updates our
        // window.opener, and then closes this popup. [49R6BRD2]
        (eds.isInLoginWindow ? '' : 'isInLoginPopup&') +
        'returnToUrl=' + (props.anyReturnToUrl || '');
    if (eds.isInLoginWindow) {
      // Let the server know we're in a login window, so it can choose to reply with
      // complete HTML pages to show in the login window.
      // (Use a cookie not an URL param because the cookie will be present later whe we're
      // being redirected back to the server from the OpenAuth provider.)
      getSetCookie('dwCoIsInLoginWindow', 'true');
      // Maybe we're in a blog comments login popup? Then, cookies might not work,
      // in the blog comments iframes — then, tell the server
      // to include the session id in the response body, so we can access it browser side.
      // Also see Server.ts. [NOCOOKIES]
      const mainWin = getMainWin();
      if (!win_canUseCookies(mainWin)) {
        // (We can use cookies here in this login window — they're 1st party cookies.
        // But not in the main window — which should be an embedded comments iframe,
        // that is, 3rd party cookies, blocked.)
        getSetCookie('TyCoAvoidCookies', 'Avoid');
      }
      window.location.assign(url);
    }
    else {
      d.i.createLoginPopup(url);
    }
  },
  render: function() {
    return (
      Button({ id: this.props.id, className: this.props.iconClass, onClick: this.onClick },
        this.props.content || this.props.provider));
  }
});


// Later, create some OpenId button too? Old LiveScript code:  CLEAN_UP REMOVE
/**
 * Logs in at Yahoo by submitting an OpenID login form in a popup.
 * /
function submitOpenIdLoginForm(openidIdentifier)
  form = $("""
    <form action="#{eds.ser x verOrigin}/-/api/login-openid" method="POST">
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



const PasswordLoginDialogContent = createClassAndFactory({
  displayName: 'PasswordLoginDialogContent',

  getInitialState: function() {
    return {};
  },

  doLogin: function() {
    const emailOrUsername = this.refs.whoInput.getValue();
    const password = this.refs.passwordInput.getValue();
    Server.loginWithPassword(emailOrUsername, password, () => {
      // Got logged in.
      login.continueAfterLogin(this.props.anyReturnToUrl);
    }, () => {
      // Bad username or password.
      this.setState({ badPassword: true, hideBadPasswordMessage: false });
      this.refs.passwordInput.getInputDOMNode().focus();
    }, () => {
      // This account has no password associated with it. [5WJBNR2]
      util.openDefaultStupidDialog({
        body: t.ld.NoPwd,
        dialogClassName: 'e_NoPwD',
        small: true,
        closeButtonTitle: t.ld.CreatePwd,
        onCloseOk: (whichButton) => {
          if (whichButton === 1) { // primary button
            window.open(linkToResetPassword(), '_blank');
          }
        }
      });
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
        PrimaryButton({ className: 's_LD_LoginB', onClick: this.doLogin, id: 'e2eSubmit' },
          loginToWhat(this.props.loginReason)),
        r.br(),
        r.a({ href: linkToResetPassword(),
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
    case 'LoginToSubmit': return t.ld.LogInToSubmit;
    case 'LoginToComment': return t.ld.LogInToComment;
    case 'LoginToCreateTopic': return t.ld.LogInToCreateTopic;
    default: return t.ld.LogIn;
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
