import * as u from '../utils/utils';
import constructSsoLoginTest from './sso-login-member-impl.2browsers.test';


constructSsoLoginTest(`sso.logout-url.2br  TyTE2ESSOLGOURL2`, {
    loginRequired: false,
    ssoLogoutUrl: `http://localhost:8080/${u.ssoLogoutRedirPageSlug}`,
    approvalRequired: false  });
