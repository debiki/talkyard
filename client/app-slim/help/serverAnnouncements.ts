/*
 * Copyright (c) 2021 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../ReactStore.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />
/// <reference path="./help.ts" />

//------------------------------------------------------------------------------
  namespace debiki2.help {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


/// Announcements to admins (sometimes mods or core members) about the server,
/// e.g. if the server just got upgraded to a new version,
/// or actions required to work around bugs.
///
/// All announcements must have tips ids like /^SAn_/ (so the un-hide announcements
/// button knows what's a help tips, and what's a server announcement.)
///
export function getServerAnnouncements(store: Store): RElm | Nl {
  const me: Myself = store.me;
  if (!me.isAdmin) return null;

  // Announcement about HTTPS certificates renewal problem.
  // Only for admins for self hosted sites, created after revision 895b7aa6e2
  // "Code review: Auto https ...", Mars 20, 2021, in talkyard-prod-one.
  const autoLuaCertFromMs = 1616112000 * 1000 // 2021-03-19 00:00:00Z
  const maybeCertBug =
      isSelfHosted() && me.siteCreatedAtMs && autoLuaCertFromMs < me.siteCreatedAtMs;
  let certBugAnn: RElm | Nl = !maybeCertBug ? null :
      help.HelpMessageBox({ message: {
          // SAn = Server Announcement, RnCt = Renew HTTPS Certificate tips nr 1.
          id: 'SAn_RnCt1', isWarning: true, version: 1,
          content: rFr({},
            r.p({},
              r.b({}, "Action required:"), " For HTTPS cert to get renewed, " +
              "clear the Redis cache — read more at ",
              ExtVerbLink(
                  'https://www.talkyard.io/-565/self-hosted-bug-auto-cert-renewal'),
              " (this is because of a Talkyard bug)."),
            ThisShownToAdminsOnly()),
      } });

  let e2eTestAnn: RElm | Nl = null;
  // @ifdef DEBUG
  if (document.querySelector('h1.dw-p-ttl')?.textContent === "Hide_Unhide_Tips_") {
    certBugAnn = null;
    e2eTestAnn =
          help.HelpMessageBox({ message: {
              id: 'SAn_E2e1', isWarning: true, version: 1,
              content: rFr({},
                r.p({}, "This is a test announcement, shown in E2E tests only."),
                ThisShownToAdminsOnly()),
          } });
  }
  // @endif

  return (
    r.div({ className: 'c_SrvAnns' },
      e2eTestAnn,
      certBugAnn,
    ));
}


function ThisShownToAdminsOnly() {
  return r.p({ className: 'c_TBx_WhoSee'}, "(This shown to admins only)");
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
