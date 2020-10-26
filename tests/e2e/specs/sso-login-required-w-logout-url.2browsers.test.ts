import constructSsoLoginTest from './sso-login-member-impl.2browsers.test';


constructSsoLoginTest("sso-login-required-w-logout-url.2browsers  TyTE2ESSOLGOURL", {
    loginRequired: true,
    // This server and page don't exist; the browser will show an error. Fine.
    ssoLoginRequiredLogoutUrl: 'http://localhost:8080/after-logout-page.html',
    approvalRequired: false  });
