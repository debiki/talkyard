import constructSsoLoginTest from './sso-login-member-impl.2browsers.test';
import { dieIf } from '../utils/log-and-die';



const frenchUser: ExternalUser = {
  ssoId: 'French user sso id',

  // French accents:
  // The accent circonflexe
  //   The accent tréma |
  // The accent grave | |
  // The accent aigu| | | .-- Single quuote
  // The cédille  | | | | |  .-- Double quote
  //            | | | | | |  |
  //            v v v v v v  v
  fullName: `Fr Ç é ù ï â 'S "D`,  // TyT603KTMM653
  primaryEmailAddress: 'e2e-test-french-user@ex.co',
  isEmailAddressVerified: true,
};


const emailConflictUser: ExternalUser = {
  ssoId: 'another user',
  fullName: 'I Like Others Emails',
  primaryEmailAddress: frenchUser.primaryEmailAddress, // conflict ...  TyT0WMRSKJ4
  isEmailAddressVerified: true,
};


const andQuestUser: ExternalUser = {
  ...emailConflictUser,
  fullName: `And& Qu? Ha# Eq=`,   // TyT603KTMM653
  primaryEmailAddress: 'e2e-test-and-quest@ex.co',  // ... unique, fine
};


const usernameNoFullNameUser: ExternalUser = {
  ssoId: 'user with own un sso id',
  username: `i_have_my_own_un`,
  // fullName — no, undefined.
  primaryEmailAddress: 'e2e-test-un-no-fn@ex.co',
  isEmailAddressVerified: true,
};


const usernameAndFullNameUser: ExternalUser = {
  ssoId: 'usr w both un and fn sso id',
  username: `my_own_un`,
  fullName: `My Own é á 'Full "Name`,
  primaryEmailAddress: 'e2e-test-un-and-fn@ex.co',
  isEmailAddressVerified: true,
};


const weridUsernameUser: ExternalUser = {
  ssoId: 'weird un sso id',
  // Same name as the French user (dieIf-tested below).
  username: `Fr Ç é ù ï â 'S "D`,  // accents and quotes get removed  TyT603KTMM653
  primaryEmailAddress: 'e2e-test-weird-un@ex.co',
  isEmailAddressVerified: true,
};

dieIf(weridUsernameUser.username !== frenchUser.fullName, 'TyE4FM06WKD');

const frenchUsernameAfteMustBe = 'Fr_C_e_u_i_a_S_D';

const extUsers = [{ //: ExtUserAndResult
  extUser: frenchUser,
  usernameAfteMustBe: frenchUsernameAfteMustBe,
}, {
  extUser: emailConflictUser,
  usernameAfteMustBe: '',
  expectedErrorCode: 'TyESSOEMLCONFL_',
}, {
  extUser: andQuestUser,
  usernameAfteMustBe: 'And_Qu_Ha_Eq',
}, {
  extUser: usernameNoFullNameUser,
  usernameAfteMustBe: usernameNoFullNameUser.username,
}, {
  extUser: usernameAndFullNameUser,
  usernameAfteMustBe: usernameAndFullNameUser.username,
}, {
  extUser: weridUsernameUser,
  // A random number gets appended to make the username unique [mk_un_unq]
  // — otherwise it'd be the same as the French user's username.
  usernameAfteMustMatch:
        new RegExp(frenchUsernameAfteMustBe + '[0-9]'),  // TyT05MSH47R
}];


constructSsoLoginTest("sso-login-new-members.2browsers.test.ts  TyT306FKRDJ5", {
        loginRequired: false, approvalRequired: false, extUsers });

