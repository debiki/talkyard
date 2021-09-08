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


let loginDialog;


export function getLoginDialog(): AuthnDlgIf {   // also called from Scala template
  if (!loginDialog) {
    loginDialog = ReactDOM.render(LoginDialog(), utils.makeMountNode());
  }
  return loginDialog;
}


/// One can click buttons to switch the authn dialog to a login dialog ('2LgI'),
/// a "just type your name" guest ('2Gst') login dialog (not always enabled),
/// or a create-account Sign Up dialog ('2SgU').
///
type SwitchAuthnDialogTo = '2LgI' | '2Gst' | '2SgU';


interface LoginDialogState {
  store: Store;
  isOpen?: Bo;
  preventClose?: Bo;
  isSignUp?: Bo;
  isForGuest?: Bo;
  loginReason?: LoginReason;
  anyReturnToUrl?: St;
  afterLoginCallback?;
  childDialog?;
  isLoggedIn?: Bo;
}


const LoginDialog = createClassAndFactory({
  displayName: 'LoginDialog',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function (): LoginDialogState {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    const newStore: Store = debiki2.ReactStore.allData();
    this.setState({ store: newStore } as LoginDialogState);
    const loggedInUser = newStore.me;
    if (loggedInUser) {
      // Might have just logged in in another tab. Then cancel any login happening in this tab.
      // Or, if we logged in in this tab, just close the dialog.
      login.anyContinueAfterLoginCallback = null;
      this.setState({
        isOpen: false,
        childDialog: null
      } as LoginDialogState);
    }
  },

  openToLogIn: function(loginReason: LoginReason,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {
    this.open(false, loginReason, anyReturnToUrl, callback, preventClose);
  },

  // Called from Scala template.
  openToSignUp: function(loginReason: LoginReason,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {
    // CLEAN_UP replace openToLogIn and openToSignUp with just one open(loginReason, ..) that
    // decides if to log in or sig up? For now:
    const reallySignup =
            loginReason !== LoginReason.LoginToAdministrate &&
            loginReason !== LoginReason.LoginToLogin;
            // Hmm some enum vals missing .. Not important.
    this.open(reallySignup, loginReason, anyReturnToUrl, callback, preventClose);
  },

  open: function(isSignUp: boolean, loginReason: LoginReason,
        anyReturnToUrl?: string, callback?: () => void, preventClose?: boolean) {

    dieIf(isInSomeEmbCommentsIframe(), 'Login dialog in some emb cmnts iframe [EdE5KER2]');
    const state: LoginDialogState = this.state;
    const store: Store = state.store;

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

    this.setLoginRelatedCookies();
    if (!anyReturnToUrl) {
      anyReturnToUrl = window.location.toString();
    }

    login.anyContinueAfterLoginCallback = callback;

    if (store.settings.allowSignup === false)
      isSignUp = false;

    // When logging in to an embedded comments discussion, if guest login is enabled,
    // then assume that's what most people want to use.
    const isForGuest = isSignUp && loginReason === LoginReason.PostEmbeddedComment &&
        store.settings.allowGuestLogin;

    this.setState({
        isOpen: true,
        isSignUp,
        isForGuest,
        loginReason,
        afterLoginCallback: callback,
        anyReturnToUrl,
        preventClose: preventClose || loginReason === LoginReason.AuthnRequiredToRead ||
            loginReason === LoginReason.LoginToAdministrate,
        isLoggedIn: !!getSetCookie('dwCoSid'),
      });
  },


  /// Returns: [anyAfterLoginCallback, anyReturnToUrl]
  getDoAfter: function(): [() => U | U, St | U] {
    const state: LoginDialogState = this.state;
    return [state.afterLoginCallback, state.anyReturnToUrl];
  },


  switchDialog: function(toWhat: SwitchAuthnDialogTo) {
    const state: LoginDialogState = this.state;
    // @ifdef DEBUG
    dieIf(toWhat === '2Gst' && state.isForGuest, 'TyE602MRKD3');
    dieIf(toWhat === '2LgI' && !state.isSignUp, 'TyE602MRKD4');
    dieIf(toWhat === '2SgU' && state.isSignUp && !state.isForGuest, 'TyE602MRKD5');
    // @endif
    // Guest "login" creates a new account, so it's actually a sign up thing.
    const isSignUp = toWhat === '2SgU' || toWhat === '2Gst';
    this.setState({ isSignUp, isForGuest: toWhat === '2Gst' });
  },

  /**
   * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
   */
  setLoginRelatedCookies: function() {
    getSetCookie('dwCoReturnToUrl', null);
    getSetCookie('dwCoReturnToSite', null);
    // Don't clear dwCoReturnToSiteXsrfToken — that'd break parallel login, [PRLGIN]
    // and break OAuth login if opens the login dialog, clicks "Google" to open a Google
    // login popup, then closes and reopens the login dialog, and then logs in at Google
    // in the popup.
    getSetCookie('dwCoIsInLoginPopup', null);
    getSetCookie('dwCoMayCreateUser', null);
    getSetCookie('dwCoOAuth2State', null);
    getSetCookie('esCoImp', null);

    if (!eds.isInLoginWindow) {
      // We're in a login popup, not in a dedicated "full screen" login window.
      getSetCookie('dwCoIsInLoginWindow', null);
    }
    else {
      // Later, remove dupl [.687263] below.
      //
      // Let the server know we're in a login window, so it can choose to reply with
      // complete HTML pages to show in this window — rather than trying to tell
      // a non-existing window.opener to continue (e.g. creating a new Ty account).
      //
      // Use a cookie not an URL param because the cookie will be present later whe we're
      // being redirected back to the server from the OpenAuth provider
      // CLEAN_UP when removing Silhouette: Now, year 2020, 2021, cookie not needed?
      // Now remembered via URL param in OngoingAuthnState,isInLoginPopup.
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
    }
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
    const state: LoginDialogState = this.state;
    const fade = state.childDialog ? ' dw-modal-fade' : '';

    /*  Use loginToWhat() instead  [authn_reason_info]
    let title;
    switch (state.loginReason) {
      case LoginReason.AuthnRequiredToRead:
        title = t.ld.AuthRequired;
        break;
      case LoginReason.LoginToLike:
        title = t.ld.LogInToLike;
        break;
      default:
        title = this.state.isSignUp ? t.ld.CreateAcconut : t.ld.LogIn;
    } */

    const content = LoginDialogContent({
        isSignUp: state.isSignUp,
        isForGuest: state.isForGuest,
        allowGuestLogin: state.store.settings.allowGuestLogin,
        loginReason: state.loginReason,
        anyReturnToUrl: state.anyReturnToUrl,
        afterLoginCallback: state.afterLoginCallback,
        setChildDialog: this.setChildDialog,
        childDialog: state.childDialog,
        closeDialog: this.close,
        isLoggedIn: state.isLoggedIn,
        switchDialog: this.switchDialog,
        store: state.store } as LoginDialogContentProps);

    /* UX SHOULD show this close [x] in 'content' instead, so can be closed easily.
    var modalHeader = state.loginReason === LoginReason.BecomeOwner
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


interface LoginDialogContentProps {
  store: Store;
  loginReason: LoginReason;
  anyReturnToUrl?: St;
  isSignUp: Bo;
  isLoggedIn: Bo;
  isForGuest: Bo;
  allowGuestLogin?: Bo;
  closeDialog: (_?: 'CloseAllLoginDialogs') => Vo;
  setChildDialog;
  switchDialog: (toWhat: SwitchAuthnDialogTo) => Vo;
}


/**
 * (This no longer needs to be a separate component. In the past, in embedded
 * discussions, it was placed directly in a popup window, no modal dialog around.)
 *
 * RENAME to AuthnDlg and file too?
 */
const LoginDialogContent = createClassAndFactory({
  displayName: 'LoginDialogContent',

  componentDidMount: function() {
    const props: LoginDialogContentProps = this.props;
    const store: Store = props.store;
    const settings: SettingsVisibleClientSide = store.settings;

    // Redirect directly to any SSO page, if 1) SSO enabled and 2) login is required,
    // and 3) a [navigate elsewhere after logout] url has been configured (to avoid
    // possibly instant login after logout),
    // so one won't see an empty page with just a "Log In" button (the .s_LD_SsoB button).
    // This redirect could be done server side, here: [COULDSSOREDIR]. However, then
    // makeSsoUrl() would need to be available server side too.
    // Dupl code? [SSOINSTAREDIR]
    const ssoUrl = makeSsoUrl(store, location.toString());

    // Sleeping BUG won't work if in /-/login-popup opened from here: [23095RKTS3],
    // because then that'll become the returnToUrl, so we'll
    // return to /-/login-popup after login, and then that page shows
    // an error about returnToUrl or nonce missing.
    // Solution: If there's a returnToUrl query param already — reuse it.
    //logD(`LoginDialog.componentDidMount: Constructed ssoUrl: ${ssoUrl}`);
    //logD(`location.toString() was: ${location.toString()}`);

    let shallRedir;
    if (settings.ssoWillRedirAfterLogout) {
      // Then we can redirect to the login page here — that won't make logout
      // impossible, because after logout we get redirected elsewhere,
      // rather than staying at the Ty site, which would auto redirect to the
      // SSO login page again which might log us in automatically.
      // @ifdef DEBUG
      dieIf(!ssoUrl, 'TyE395KSETRS2');
      // @endif
      shallRedir = true;
    }
    else if (ssoUrl && eds.isInLoginPopup) {
      // Then, since this site is Single Sign-On, there'd be nothing to  [insta_sso_redir]
      // choose among in this login popup — so redirect to the ssoUrl directly.
      // But, let's wait with changing any old behavior. For now, only
      // redirect, if useOnlyCustomIdps (new OIDC related code).
      // DO_AFTER 2020-11-11 always location.assign?
      shallRedir = settings.useOnlyCustomIdps;
    }

    if (shallRedir) {
      // Don't think we want to open a popup here — we're in a full screen
      // login window already?  We do if in an iframe: [2ABKW24T].
      logD(`Redir to SSO url`)
      location.assign(ssoUrl);
    }
  },

  render: function() {
    const props: LoginDialogContentProps = this.props;
    const store: Store = props.store;
    const loginReason = props.loginReason;
    const isSignUp = props.isSignUp;
    const isLogin = !isSignUp;
    const settings: SettingsVisibleClientSide = store.settings;

    const closeChildDialog = (closeAll) => {
      props.setChildDialog(null);
      if (closeAll === 'CloseAllLoginDialogs') {
        props.closeDialog();
      }
    };

    const childDialogProps = _.clone(props);

    // So can close, once authenticated (e.g. after user account created).
    childDialogProps.closeDialog = closeChildDialog;

    const [nonce, lastsAcrossReload] = login.getOrCreateAuthnNonce();

    const makeAuthnProps = (iconClass: St, provider: St, content?)
                : ExtIdpAuthnBtnProps => {
      return {
        id: 'e2eLogin' + provider,
        iconClass,
        provider,
        loginReason,
        anyReturnToUrl: props.anyReturnToUrl,
        authnNonce: nonce,
        content
      };
    };

    const isForFirstOwner = loginReason === LoginReason.BecomeOwner;
    const becomeOwnerInstructions = !isForFirstOwner ? null :
        r.div({ className: 'esLoginDlg_becomeAdminInstr' },
          r.p({},
            // Say "admin" not "owner" here — simpler to understand, and first owner is admin too.
            t.ld.CreateAdmAcct));
            // UX SHOULD add back, for first site: "Use the email address you specified in the config file."));

    // When testing on localhost, it can be confusing if cookies get discarded,
    // because of accidentally using http, not https.
    const shouldUseHttps = eds.secure;
    const usesHttpsAlready = location.protocol === 'https:';
    const notHttpsErr = !shouldUseHttps || usesHttpsAlready ? null :
        r.p({ className: 's_NotHttpsErr' },
          "Error: Not HTTPS. ",
          LinkButton({ href: location.href.replace(/^http:/, 'https:') },
            "Reload as HTTPS"));

    const notFound = loginReason === LoginReason.LoginBecauseNotFound;
    const notFoundInstructions = !notFound ? null :
        r.div({ className: 'esLoginDlg_becomeAdminInstr' },
          r.h1({ className: 's_LD_NotFound_Title' }, t.ld.NotFoundOrPrivate),
          r.p({ className: 's_LD_NotFound_Details' },
            t.ld.IfYouThinkExistsThen +
            (props.isLoggedIn ? t.ld.LoggedInAlready : '') +
            t.ld.ElseGoToHome_1, r.a({ className: 's_LD_NotFound_HomeL', href: '/' },
              t.ld.ElseGoToHome_2)));

    const loginDlg = isSignUp ? null :
        PasswordLoginDialogContent(childDialogProps);

    const isGuestSignUp = props.isForGuest;

    const signupOrGuestDlg = isLogin || settings.allowLocalSignup === false ? null :
        CreateUserDialogContent({
            ...childDialogProps,
            isForPasswordUser: !isGuestSignUp,  // <—— remove? Don't need ...
            isForGuest: isGuestSignUp,          //     ... both
          } as CreateUserDialogContentProps);

    let switchToLoginOrGuestDlg: RElm | U;
    let switchToSignupOrGuestDlg: RElm | U;

    const switchDiag = function(toWhat: SwitchAuthnDialogTo) {
      return () => props.switchDialog(toWhat);
    }

    const createAccountInstead = () =>
        r.i({ className: 'c_AuD_2SgU' },
          t.ld.SignUpInstead_1,
          r.a({ className: 'c_AuD_SwitchB', onClick: switchDiag('2SgU') },
            t.ld.SignUpInstead_2),
          t.ld.SignUpInstead_3);

    const orLoginInstead = (isTextBefore?: Bo) =>
        r.i({ className: 'c_AuD_2LgI' },
          debiki2.firstToLower(t.ld.OrLogIn_1, isTextBefore),
          r.a({ className: 'c_AuD_SwitchB', onClick: switchDiag('2LgI') },
            t.ld.OrLogIn_2),
          t.ld.OrLogIn_3);

    const orJustTypeName = () => !props.allowGuestLogin || isGuestSignUp ? null :
        r.i({ className: 'c_AuD_2Gst' },
          t.ld.OrTypeName_1,
          r.a({ className: 'c_AuD_SwitchB', onClick: switchDiag('2Gst') },
            t.ld.OrTypeName_2),
          t.ld.OrTypeName_3)

    if (isForFirstOwner) {
      // Don't show any switch-between-login-and-signup buttons.
    }
    else if (isSignUp && !isGuestSignUp) {
      // We're in the Create Account (aka Sign Up) dialog.
      // Show "Log in instead, or just type your name" dialog switch buttons.
      // If no signup fields above, center align the "Or log in instead" text, else looks weird.
      const style = settings.allowLocalSignup === false ? { textAlign: 'center' } : null;
      switchToLoginOrGuestDlg =
          r.div({ className: 'form-group c_AuD_Switch', style }, '(',
            orLoginInstead(),
            orJustTypeName(),
            ')');
    }
    else if (store.siteStatus > SiteStatus.Active) {
      // Right now, don't allow creation of new accounts, for deactivated sites. Later, though,
      // let admins invite new staff, if the site is in ReadAndCleanOnly mode. [5PY8FD2]
      // BUG currently no store data is included on /-/login, so even if siteStatus > Active,
      // the "Create account" link inserted below (in `else`) will be added, nevertheless.
    }
    else {
      // We're in the Log In dialog, or the "just type your name" guest login.
      // Show "Or Create Account instead, or just type your name" dialog switchers.
      // @ifdef DEBUG
      // DO_AFTER 2021-03-01  remove the (..||..) below.
      dieIf(!(isLogin || isGuestSignUp), 'TyE37MRHW20');
      // @endif
      const createAcct = settings.allowSignup !== false && (isLogin || isGuestSignUp) ?
              createAccountInstead() : null;
      const isTextBefore = !!createAcct;

      switchToSignupOrGuestDlg =
          r.div({ className: 'form-group c_AuD_Switch' },
            createAcct,
            isSignUp ? orLoginInstead(isTextBefore) : null,
            orJustTypeName());
    }

    const ss = store.settings;

    const customIdps: IdentityProviderPubFields[] = ss.customIdps || [];
    const customOidcBtns = customIdps.map(idp =>
        ExtIdpAuthnBtn({
            ...makeAuthnProps('icon-user',
                  `${idp.protocol}/${idp.alias}`, idp.displayName),
            key: `${idp.protocol}/${idp.alias}`,
            idp }));

    // (Place any custom IDPs last by default — because if other authn methods enabled,
    // then, they're probably for the company's customers/users, and they're typically
    // more people than those in the company, so make things simple for them: show
    // "their" buttons first.)
    //const customIdpBtnFirst = !customIdp ? false :
    //        customIdp.guiOrder < 0;  // undef < 0  is false

    const anyOpenAuth = customIdps.length || ss.enableGoogleLogin ||
        ss.enableFacebookLogin || ss.enableTwitterLogin || ss.enableGitHubLogin ||
        ss.enableLinkedInLogin;

    const canUseCustomIdps = ss.customIdps?.length;
    const useOnlyCustomIdps = ss.useOnlyCustomIdps && canUseCustomIdps;
    const allowLocalSignup = ss.allowLocalSignup !== false && !useOnlyCustomIdps;

    let content;

    const anySsoUrl = makeSsoUrl(store, location.toString());

    // Sleeping BUG see [23095RKTS3].
    //logD(`LoginDialog.render: Constructed anySsoUrl: ${anySsoUrl}`);
    //logD(`location.toString() was: ${location.toString()}`);

    if (anySsoUrl) {
      // Maybe incl username and id in __html_encoded_volatile_json__ ?
      // Not always done in login window.
      const hasSid = getSetCookie('dwCoSid');
      const loggedInButMayNotAccess = !hasSid ? null : r.p({},
        "You're logged in but seems you cannot access this part of the site " +  // I18N
        "(if it exists). " +
        "Can you login as a user with higher permissions?")
      content =
          r.div({ style: { textAlign: 'center' }},
            ExtLinkButton({ href: anySsoUrl, className: 's_LD_SsoB btn-primary' },
              t.LogIn),
            loggedInButMayNotAccess);
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
            //customIdpBtnFirst && customOidcBtns,
            !ss.enableGoogleLogin ? null :
                ExtIdpAuthnBtn(makeAuthnProps('icon-google', 'Google')),
            !ss.enableFacebookLogin ? null :
                ExtIdpAuthnBtn(makeAuthnProps('icon-facebook', 'Facebook', rFragment({},
                  // Need to follow Facebook's brand guidelines. [FBBRAND]
                  FacebookLogoImage, "Facebook"))),
            !ss.enableTwitterLogin ? null :
                ExtIdpAuthnBtn(makeAuthnProps('icon-twitter', 'Twitter')),
            !ss.enableGitHubLogin ? null :
                ExtIdpAuthnBtn(makeAuthnProps('icon-github-circled', 'GitHub')),
            !ss.enableLinkedInLogin ? null :
                ExtIdpAuthnBtn(makeAuthnProps('icon-linkedin', 'LinkedIn')),
            //!customIdpBtnFirst && customOidcBtns,
            customOidcBtns,
            // SMALLER_BUNDLE  could remove the Yahoo icon?
            // OpenID 1.0 since long gone, so skip:  icon-yahoo Yahoo!
            )),

        isForFirstOwner || isSignUp && !allowLocalSignup ? null : (
          r.p({ id: 'dw-lgi-or-login-using' },
            anyOpenAuth
              ? (isSignUp
                  ? (isGuestSignUp ? t.ld.OrTypeName : t.ld.OrCreateAcctHere)
                  : t.ld.OrLogIn)
              : (isSignUp
                  ? (isGuestSignUp ? t.ld.YourNameQ : t.ld.SignUp)
                  : t.ld.LogIn))),

        // Either:
        switchToLoginOrGuestDlg,
        signupOrGuestDlg,

        // Or:
        // (place the "or Create Account" button below the username and password
        // inputs — because that's just two fields, so one somewhat easily sees
        // the Create Account button below.)
        loginDlg,
        switchToSignupOrGuestDlg,
        );
    }

    return (
      r.div({ className: 'c_AuD' },
        notHttpsErr,
        notFoundInstructions,
        content));
  }
});



interface ExtIdpAuthnBtnProps {
  id;
  loginReason;
  idp?;
  provider;
  anyReturnToUrl;
  authnNonce;
  content;
  iconClass;
  key?;
}


function ExtIdpAuthnBtn(props: ExtIdpAuthnBtnProps) {
  function onClick() {
    const providerLowercase = props.provider.toLowerCase();
    // Any new user wouldn't be granted access to the admin page, so don't allow
    // creation of  new users from here.
    // (This parameter tells the server to set a certain cookie. Setting it here
    // instead has no effect, don't know why.)
    const mayNotCreateUser =
            props.loginReason === 'LoginToAdministrate' ? 'mayNotCreateUser&' : '';

    // A bit weird, just now when migrating to ScribeJava.
    let useServerGlobalIdp = false;
    if (!props.idp) {
      // Try-catch not needed, but anyway.
      try {
        const store: Store = ReactStore.allData();
        useServerGlobalIdp =
              debiki2.store_isFeatFlagOn(store, 'ffUseScribeJava') ||
              getMainWin().location.hash.indexOf('&tryScribeJava&') >= 0;
        useServerGlobalIdp &&= !debiki2.store_isFeatFlagOn(store, 'ffNotScribeJava');
        // Twitter (OAuth1) doesn't yet work via ScribeJava; only these do (OAuth2):
        useServerGlobalIdp &&= providerLowercase === 'google' ||
                providerLowercase === 'facebook' ||
                providerLowercase === 'github' ||
                providerLowercase === 'linkedin' ;
      }
      catch (ex) {
        logD(`Srv glob idp err [TyE406MRKD2]`, ex);
        useServerGlobalIdp = false;
      }
    }

    const idp: IdentityProviderPubFields | U = props.idp;
    const urlPath = idp
        ? `/-/authn/${idp.protocol}/${idp.alias}`                // new & nice
        : (useServerGlobalIdp
          ? `/-/authn/oauth2/${providerLowercase}`     // always this instead?
          : `/-/login-openauth/${providerLowercase}`); // old, try to remove

    const urlPathAndQuery = urlPath +
        '?' + mayNotCreateUser +
        `nonce=${props.authnNonce}&` +
        // If we are already in a dedicated full screen login window, the server should
        // redirect us inside this window to where we want to go after login.
        // If instead this is just a login popup win, the server wants to know about that —
        // it'll then instead return a html page that runs some javascript that updates our
        // window.opener, and then closes this popup. [49R6BRD2]
        (eds.isInLoginWindow ? '' : 'isInLoginPopup&') +
        (useServerGlobalIdp ? 'useServerGlobalIdp=true&' : '') +
        `returnToUrl=${props.anyReturnToUrl || ''}`;

    const url = origin() + urlPathAndQuery;

    if (eds.isInLoginWindow) {
      // --- CLEAN_UP REMOVE this -------------
      // This is now here: [.687263] instead, so the cookies get set also if using SSO.
      //
      // Let the server know we're in a login window, so it can choose to reply with
      // complete HTML pages to show in this window (rather than trying to tell
      // a non-existing window.opener to finish the login signup).
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
      // --------------------------------------
      window.location.assign(url);
    }
    else {
      d.i.createLoginPopup(url);
    }
  }

  return (
    Button({ id: props.id, className: props.iconClass, key: props.key, onClick },
      props.content || props.provider));
}



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
 *
 * [authn_reason_info]
 */
function loginToWhat(loginReason: LoginReason): St {
  switch (loginReason) {
    case LoginReason.PostReply: return t.ld.LogInToComment;
    case LoginReason.CreateTopic: return t.ld.LogInToCreateTopic;
    default: return t.ld.LogIn;
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
