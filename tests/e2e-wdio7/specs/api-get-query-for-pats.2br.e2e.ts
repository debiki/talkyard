/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { j2s, logMessage, logServerResponse } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let trillian: Member;
let trillian_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;


let site: IdAddress;
let forum: TwoCatsTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};


async function getPatsOrFail(refs, what?: 'Fail' | TestApiSecret)
        : Pr<GetQueryResults<TyPat> | St> {
  return await server.apiV0.getQuery<TyPat>({
    origin: site.origin,
    getQuery: {
      getWhat: 'Pats',
      getRefs: refs,
      inclFields: {}, // later, e.g.: { username: true, ssoId: true }
      // Leave out ——> default fields.
    },
  }, {
    fail: what === 'Fail',
    apiRequesterId: (what as TestApiSecret)?.userId,
    apiSecret: (what as TestApiSecret)?.secretKey,
  })
}

async function getPatsOk(who, apiSecret?: TestApiSecret): Pr<GetQueryResults<TyPat>> {
  return (await getPatsOrFail(who, apiSecret)) as GetQueryResults<TyPat>;
}

async function getPatsButFail(who): Pr<St> {
  return (await getPatsOrFail(who, 'Fail')) as St;
}



describe(`api-get-query-for-pats.2br  TyTEAPIGETQPATS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Get Pats API E2E Test",
      members: ['modya', 'trillian', 'memah', 'maria', 'michael'],
    });

    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    trillian = forum.members.trillian;
    trillian_brB = brB;
    trillian.ssoId = 'trillian_ssoid';
    trillian.extId = 'trillian_extid';

    maria = forum.members.maria;
    maria_brB = brB;
    maria.ssoId = 'maria_ssoid';
    //maria.extId — skip

    memah = forum.members.memah;
    memah_brB = brB;
    memah.ssoId = 'memah_ssoid';
    memah.extId = 'memah_extid';

    michael = forum.members.michael;
    michael_brB = brB;
    //michael.ssoId — none
    michael.extId = 'michael_extid';

    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  // ---- Could skip this: ---------------
  it(`Owen goes to the admin area, without logging in`, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    //await owen_brA.loginDialog.loginWithPassword(owen);
  });

  it(`Maria goes to the homepage`, async () => {
    await maria_brB.go2(site.origin);
    //await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  // -------------------------------------


  let response: GetQueryResults<TyPat>;
  let expectedTrillianNoSsoId: Partial<TyPat>;
  let expectedTrillian: Partial<TyPat>;
  let expectedMemah: Partial<TyPat>;
  let expectedMichael: Partial<TyPat>;


  // ----- Look up by username


  it(`A stranger calls /-/get  username:trillian,  but w/o any API secret`, async () => {
    response = await getPatsOk(['username:trillian']);
    logMessage(j2s(response));
  });


  it(`... gets back 1 thing-or-err`, async () => {
    assert.eq(response.thingsOrErrs.length, 1);
  });


  it(`... namely Trillian`, async () => {
    const tri = forum.members.trillian;
    expectedTrillianNoSsoId = {
      id: tri.id,
      username: tri.username,
      fullName: tri.fullName,
      // These shouldn't be included unless API secret specified:
      ssoId: undefined,
      extId: undefined,
      // Only if admin/system API secret specified, and getWhat specifies email addr:
      emailAddress: undefined,
      // TESTS_MISSING instead of the line above, do sth like:
      //    assert.noFieldNameLike(/email/i)  ?
    };
    assert.partialEq(response.thingsOrErrs[0], expectedTrillianNoSsoId);
  });


  // ----- Sysbot sees sso and ext ids


  it(`Sysbot calls /-/get  username:trillian, *with* an API secret`, async () => {
    response = await getPatsOk(['username:trillian'], apiSecret);
    logMessage(j2s(response));
  });


  it(`... gets back 1 thing-or-err`, async () => {
    assert.eq(response.thingsOrErrs.length, 1);
  });


  it(`... namely Trillian, this time too. Now extId and ssoId are included`, async () => {
    expectedTrillian = {
      ...expectedTrillianNoSsoId,
      extId: 'trillian_extid',
      ssoId: 'trillian_ssoid',
    };
    assert.partialEq(response.thingsOrErrs[0], expectedTrillian);
  });


  // ----- Look up by sso id

  let responseSt: St;

  it(`A stranger looks up Memah by sso id — not allowed, no API secret specified`, async () => {
    responseSt = await getPatsButFail(['ssoid:memah_ssoid']);
  });
  it(`... the error response says something about sso id and ext id`, async () => {
    // Could add a special error code for this?
    logServerResponse(responseSt);
    assert.includes(responseSt, 'only admins and sysbot');
    assert.includes(responseSt, 'sso id');
    assert.includes(responseSt, 'ext id');
  });


  it(`Sysbot looks up Memah by sso id — fine, API secret specified`, async () => {
    response = await getPatsOk(['ssoid:memah_ssoid'], apiSecret);
    const m = forum.members.memah;
    expectedMemah = {
      id: m.id,
      username: m.username,
      fullName: m.fullName,
      extId: 'memah_extid',
      ssoId: 'memah_ssoid',
    };
  });
  it(`... gets back Memah`, async () => {
    assert.partialEq(response.thingsOrErrs[0], expectedMemah);
  });


  // ----- Look up by ext id


  it(`Sysbot can look up by ext id too`, async () => {
    response = await getPatsOk(['extid:michael_extid'], apiSecret);
    const m = forum.members.michael;
    expectedMichael = {
      id: m.id,
      username: m.username,
      fullName: m.fullName,
      extId: 'michael_extid',
      ssoId: undefined,  // Michael has no sso-id
    };
  });
  it(`... gets back Michael`, async () => {
    assert.partialEq(response.thingsOrErrs[0], expectedMichael);
  });


  // ----- Look up by wrong id


  it(`But sysbot specifies the wrong sso id`, async () => {
    response = await getPatsOk(['ssoid:wrong_ssoid'], apiSecret);
  });

  it(`... gets back 1 thing-or-err`, async () => {
    assert.eq(response.thingsOrErrs.length, 1);
  });

  it(`... it's a not-found error`, async () => {
    assert.partialEq(response.thingsOrErrs[0], {
      // Hmm currently this err code is used, whatever the error is.
      errCode: 'TyEPATNF_',
    });
  });


  it(`Sysbot looks up many pats at once, incl some that don't exist`, async () => {
    response = await getPatsOk([
          'username:mod_modya',
          'username:wrong-username',
          'username:trillian',
          'ssoid:wrong_ssoid',
          'ssoid:memah_ssoid',
          'extid:wrong_extid',
          'extid:michael_extid'], apiSecret);
  });

  it(`... gets back 7 items`, async () => {
    assert.eq(response.thingsOrErrs.length, 7);
  });

  it(`... namely Modya at [0]`, async () => {
    assert.partialEq(response.thingsOrErrs[0], {
      username: forum.members.modya.username,
      fullName: forum.members.modya.fullName,
      ssoId: undefined,
      extId: undefined,
    });
  });

  it(`... not found at [1], [3], [5]`, async () => {
    assert.partialEq(response.thingsOrErrs[1], { errCode: 'TyEPATNF_' });
    assert.partialEq(response.thingsOrErrs[3], { errCode: 'TyEPATNF_' });
    assert.partialEq(response.thingsOrErrs[5], { errCode: 'TyEPATNF_' });
  });

  it(`... Trillian at [2]`, async () => {
    assert.partialEq(response.thingsOrErrs[2], expectedTrillian);
  });

  it(`... Memah at [4]`, async () => {
    assert.partialEq(response.thingsOrErrs[4], expectedMemah);
  });

  it(`... Michael at [6]`, async () => {
    assert.partialEq(response.thingsOrErrs[6], expectedMichael);
  });

});
