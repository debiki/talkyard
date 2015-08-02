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
/// <reference path="create-user-dialog.ts" />

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


export var loginDialog;


export function createLoginDialog() {
  function makeMountNode() {
    return $('<div>').appendTo('body')[0];
  }
  loginDialog = React.render(LoginDialog(), makeMountNode());
}


var LoginDialog = createClassAndFactory({
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      childDialog: null,
    };
  },

  onChange: function() {
    var loggedInUser = debiki2.ReactStore.allData().user;
    if (loggedInUser) {
      this.setState({
        isOpen: false,
        childDialog: null
      });
    }
  },

  open: function(loginReason: string, anyReturnToUrl: string, preventClose: boolean) {
    this.clearLoginRelatedCookies();
    this.setState({
      isOpen: true,
      loginReason: loginReason,
      anyReturnToUrl: anyReturnToUrl,
      preventClose: preventClose,
      isLoggedIn: !!$['cookie']('dwCoSid'),
    });
  },

  /**
   * Clears login related cookies so e.g. any lingering return-to-url won't cause troubles.
   */
  clearLoginRelatedCookies: function() {
    $['cookie']('dwCoReturnToUrl', null)
    $['cookie']('dwCoReturnToSite', null)
    $['cookie']('dwCoReturnToSiteXsrfToken', null)
    $['cookie']('dwCoIsInLoginWindow', null)
    $['cookie']('dwCoMayCreateUser', null)
  },

  close: function() {
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
    var fade = this.state.childDialog ? ' dw-modal-fade' : '';

    var content = LoginDialogContent({ loginReason: this.state.loginReason,
        anyReturnToUrl: this.state.anyReturnToUrl, setChildDialog: this.setChildDialog,
        childDialog: this.state.childDialog, close: this.close, isLoggedIn: this.state.isLoggedIn });

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'dw-login-modal' + fade,
          keyboard: !this.state.childDialog && !this.state.preventClose,
          backdrop: this.state.preventClose ? 'static' : true },
        ModalHeader({ closeButton: !this.state.preventClose }, ModalTitle({}, "Who are you?")),
        ModalBody({}, content),
        ModalFooter({}, Button({ onClick: this.close }, 'Cancel'))));
  }
});


/**
 * This is a separate component because on embedded discussion pages, it's placed directly
 * in a popup window with no modal dialog around.
 */
export var LoginDialogContent = createClassAndFactory({
  render: function() {
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
    }

    var childDialogProps = _.clone(this.props);
    childDialogProps.closeDialog = closeChildDialog;
    childDialogProps.createPasswordUser = true;

    var createChildDialog = (title, contentFactory) => {
      return (
        Modal({ show: this.props.childDialog === contentFactory, onHide: closeChildDialog },
          ModalHeader({ closeButton: true }, ModalTitle({}, title)),
          ModalBody({}, contentFactory(childDialogProps))));
    }

    var createUserDialog = createChildDialog("Create Password Account", CreateUserDialogContent);
    var passwordLoginDialog = createChildDialog("Login with Password", PasswordLoginDialogContent);
    var guestLoginDialog = createChildDialog("Login as Guest", GuestLoginDialogContent);

    var makeOauthProps = (iconClass: string, provider: string) => {
      return {
        iconClass: iconClass,
        provider: provider,
        loginReason: this.props.loginReason,
        anyReturnToUrl: this.props.anyReturnToUrl,
      };
    };

    var loggedInAlreadyInfo = this.props.isLoggedIn
        ? r.p({}, "You are logged in already, but you don't have access " +
            "to this part of the site. Please login below, as someone with access.")
        : null;

    var andDoWhat = ', and zzz, ';
    return (
      r.div({ className: 'dw-login-dialog' },
        createUserDialog,
        passwordLoginDialog,
        guestLoginDialog,
        loggedInAlreadyInfo,
        r.p({ id: 'dw-lgi-tos' },
          "By logging in, you agree to the ", r.a({ href: "/-/terms-of-use" }, "Terms of Use"),
          " and the ", r.a({ href: '/-/privacy-policy' }, "Privacy Policy")),

        r.p({ id: 'dw-lgi-or-login-using' },
          "Login" + andDoWhat + "using your account (if any) at"),
        r.div({ id: 'dw-lgi-other-sites' },
          OpenAuthButton(makeOauthProps('icon-google-plus', 'Google')),
          OpenAuthButton(makeOauthProps('icon-facebook', 'Facebook')),
          OpenAuthButton(makeOauthProps('icon-twitter', 'Twitter')),
          OpenAuthButton(makeOauthProps('icon-github', 'GitHub'))),
          // OpenID doesn't work right now, skip for now:  icon-yahoo Yahoo!

        r.p({ id: 'dw-lgi-or-login-using' }, "Or, alternatively:"),

        ButtonGroup({ vertical: true },
          Button({ onClick: openChildDialog(CreateUserDialogContent) }, "Create New Account"),
          Button({ onClick: openChildDialog(PasswordLoginDialogContent) }, "Login with Password"),
          Button({ onClick: openChildDialog(GuestLoginDialogContent) }, "Login as Guest"))));
  }
});


var OpenAuthButton = createClassAndFactory({
  onClick: function() {
    var props = this.props;
    // Any new user wouldn't be granted access to the admin page, so don't allow
    // creation of  new users from here.
    // (This parameter tells the server to set a certain cookie. Setting it here
    // instead has no effect, don't know why.)
    var mayNotCreateUser = props.loginReason === 'LoginToAdministrate' ? '&mayNotCreateUser' : '';
    var url = d.i.serverOrigin +
        '/-/login-openauth/' + props.provider.toLowerCase() +
        '?returnToUrl=' + (props.anyReturnToUrl || '') + mayNotCreateUser;
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
      Button({ className: this.props.iconClass, onClick: this.onClick }, this.props.provider ));
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
  doLogin: function() {
    var name = this.refs.nameInput.getValue();
    var email = this.refs.emailInput.getValue();
    Server.loginAsGuest(name, email, () => {
      continueAfterLogin(this.props.anyReturnToUrl);
    });
  },
  render: function() {
    var inOrderTo = "";
    return (
      r.form({},
        Input({ type: 'text', label: "Your name:", ref: 'nameInput' }),
        Input({ type: 'text', label: "Email: (optional, not shown)", ref: 'emailInput',
            help: "If you want to be notified about replies to your comments." }),
        Button({ onClick: this.doLogin }, "Login" + inOrderTo),
        Button({ onClick: this.props.closeDialog }, "Cancel")));
  }
});


var PasswordLoginDialogContent = createClassAndFactory({
  doLogin: function() {
    var emailOrUsername = this.refs.whoInput.getValue();
    var password = this.refs.passwordInput.getValue();
    Server.loginWithPassword(emailOrUsername, password, () => {
      continueAfterLogin(this.props.anyReturnToUrl);
    });
  },
  render: function() {
    var inOrderTo = "";
    return (
      r.form({},
        Input({ type: 'text', label: "Email or username:", ref: 'whoInput' }),
        Input({ type: 'text', label: "Password:", ref: 'passwordInput' }),
        Button({ onClick: this.doLogin }, "Login" + inOrderTo),
        Button({ onClick: this.props.closeDialog }, "Cancel"),
        r.br(),
        r.a({ href: debiki.internal.serverOrigin + '/-/reset-password/specify-email',
            target: '_blank', className: 'dw-reset-pswd' },
          "Did you forget your password?")));
  }
});


function continueAfterLogin(anyReturnToUrl: string) {
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
    debiki2.ReactActions.login();
    // Continue with whatever caused the login to happen.
    // Old comment, perhaps obsolete:
    //   If the login happens because the user submits a reply,
    //   then, if the reply is submitted (from within
    //   continueAnySubmission) before the dialog is closed, then,
    //   when the browser moves the viewport to focus the new reply,
    //   the welcome dialog might no longer be visible in the viewport.
    //   But the viewport will still be dimmed, because the welcome
    //   dialog is modal. So don't continueAnySubmission until
    //   the user has closed the response dialog.
    if (debiki.internal.continueAnySubmission) {
      debiki.internal.continueAnySubmission();
    }
  }
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
