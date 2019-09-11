import constructSsoLoginTest from './sso-login-member-impl.2browsers.test';


constructSsoLoginTest("sso-login-required  TyT7KSD20RG42", {
    loginRequired: true,
    // This server and page don't exist; the browser will show an error. Fine.
    ssoLoginRequiredLogoutUrl: 'http://localhost:8080/after-logout-page.html',
    approvalRequired: false  });
