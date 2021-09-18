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

  // ----- Dynamic notices

  // Depends on features enabled / in use at this particular site).

  const adminNotices: RElm[] = (me.adminNotices || []).map((notice: Notice) => {
    let text: St | RElm = 'TyE02MREG56';
    switch (notice.id) {
      case Notices.TwitterLoginConfigured:
        const anyoneUsesTwitterLogin =
                _.some(me.adminNotices, n => n.id === Notices.TwitterLoginInUse);
        text = r.p({},
              r.b({ className: 'e_TwLgI-Conf' }, "Twitter login willl stop working. "),
              "Twitter login is enabled in this forum" + (
              anyoneUsesTwitterLogin ? '.' : " — but it seems no one uses it."));
        break;
      case Notices.TwitterLoginInUse:
        text = r.p({},
              r.b({ className: 'e_TwLgI-InUse' }, "Twitter login in use"),
              " — but will stop working.");
        break;
      case Notices.ChangeBlogCommentsOrigin:  // [emb_coms_origin]
        text = rFr({},
            r.p({},
              r.b({}, "Action required: "),
              "In your blog's HTML templates, change the Talkyard server URL to ",
              r.code({}, eds.pubSiteIdOrigin), ", like so:"),
            r.pre({},
              `<script>talkyardServerUrl='${eds.pubSiteIdOrigin}';</script>`),
            r.p({},
            `Thereafter you might need to regenerate your blog (depending on what ` +
            `blog platform you use) and push to your Git repo (if any).`),
            r.p({},
              r.b({}, `Background: `),
              `Some/many users might be unable to log in and post comments, ` +
              `because the Safari web browser (unsure about Chrome and Edge) ` +
              `shows a security warning in the login popup ` +
              `(instead of showing the login popup contents). `),
            r.p({},
              `The browser would do that if it thinks your ` +
              `auto generated Talkyard comments site address, is too similar ` +
              `to the address of your blog itself — this could be phishing, ` +
              `the broser thinks. ` +
              `For example, if your blog address were: `, r.code({}, "blog.example.com"),
              `, Talkyard would have generated an address like: `,
              r.code({}, "comments-for-blog-example-com.talkyard.net"),
              ` which the browser can think is too similar ` +
              `(because of "`, r.i({}, 'blog-example-com'),
              `" in the Talkyard address).`),
            r.p({},
              `You can ask questions `,
              r.a({ href: 'https://www.talkyard.io/-610' },
                    "on this page over at Talkyard.io")));
        break;
      default:
    }
    // @ifdef DEBUG
    dieIf(!text, 'TyE60WEJf372');
    // @endif
    return help.HelpMessageBox({ key: notice.id, message: {
        // SAn = Server Announcement, NtcX = Notice X.
        id: `SAn_Ntc${notice.id}`, version: 1, isWarning: true,
        content: rFr({}, text, ThisShownToAdminsOnly()),
    } });
  });

  // ----- New version announcements

  let newTyVersionAnn: RElm =
      help.HelpMessageBox({ message: {
          // SAn = Server Announcement, TyV = Talkyard new Version announcement nr 1.
          id: 'SAn_TyV2', version: 2, isNice: true,
          content: rFr({},
            r.p({},
              r.b({ className: 'e_LstTyV'}, `New Talkyard version: ${TalkyardVersion}, `),
              "read more here: ",
              ExtVerbLink(
                  'https://www.talkyard.io/-596/talkyard-v0202123')),
            ThisShownToAdminsOnly()),
      } });

  let prevTyVersionAnn: RElm | U;
      help.HelpMessageBox({ message: {
          id: 'SAn_TyV1', version: 1, // old announcement, skip isNice
          content: rFr({},
            r.p({},
              r.b({}, `New Talkyard version: v0.2021.22, `),
              "read more here: ",
              ExtVerbLink(
                  'https://www.talkyard.io/-589/talkyard-v0202122')),
            ThisShownToAdminsOnly()),
      } });


  // ----- Other announcements

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
    newTyVersionAnn = null;
    prevTyVersionAnn = null;
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
      rFr({}, adminNotices),
      e2eTestAnn,
      certBugAnn,
      newTyVersionAnn,
      prevTyVersionAnn,
    ));
}


function ThisShownToAdminsOnly() {
  return r.p({ className: 'c_TBx_WhoSee'}, "(This shown to admins only)");
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
