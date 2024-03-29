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

  // ----- E2E tests: Show a single dummy announcement

  let isE2eTest = false;

  // @ifdef DEBUG
  isE2eTest = location.hostname.startsWith('e2e-test-');
  // But this won't work in the Admin Area:
  // const pageTitle = document.querySelector('h1.dw-p-ttl')?.textContent;
  // isE2eTest = pageTitle === 'Hide_Unhide_Tips_' ||
  //             pageTitle === 'Admin_Notices_';
  // @endif


  // ----- Notice: An exampe

  /* An example, when adding some other notice in the future:
  const sampleNotice: RElm = isE2eTest ? null :
      help.HelpMessageBox({ message: {
          // SAn = Server Announcement, BlB = Blah Blah
          id: 'SAn_BlB', version: 1, isNice: true,
          content: rFr({},
            r.p({},
              r.b({}, `Blah blah, `),
              "blah blah. Bla bla blah. Blah. Bla bla, bla blah."),
            r.p({}, `Blah bla bla blah. — Bla bla, bla? Bla, blah: Blah.`),
            ThisShownToAdminsOnly()),
      } });
      */


  // ----- Notice: Blog comments URL

  // Depends on features enabled / in use at this particular site).

  const adminNotices: RElm[] = !me.isAdmin ? [] :
            (me.adminNotices || []).map((notice: Notice) => {
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

  // Always show if is e2e test. Otherwise only if there's a not-too-old
  // external announcement (e.g. a blog post) to link to.
  const newTyVersionAnn: RElm = !isE2eTest || !me.isAdmin ? null : // there's no up-to-date ann.
      help.HelpMessageBox({ message: {
          // SAn = Server Announcement, TyV = Talkyard new Version announcement nr X.
          id: 'SAn_TyV3', version: 1, isNice: true,
          content: rFr({},
            r.p({},
              r.b({ className: 'e_LstTyV'}, `New Talkyard version: ${TalkyardVersion}, `),
              "read more here: ",
              ExtVerbLink(
                  'https://www.talkyard.io/blog/YYYY-MM-DD/...')),  // ?
            ThisShownToAdminsOnly()),
      } });

  // Too old.
  const prevTyVersionAnn: RElm | U = null; /* isE2eTest || !me.isAdmin ? null :
      help.HelpMessageBox({ message: {
          id: 'SAn_TyV1', version: 1, // old announcement, skip isNice
          content: rFr({},
            r.p({},
              r.b({}, `New Talkyard version: v0.2021.22, `),
              "read more here: ",
              ExtVerbLink(
                  'https://www.talkyard.io/-589/talkyard-v0202122')),
            ThisShownToAdminsOnly()),
      } }); */

  // Previous announcements:
  //   https://www.talkyard.io/-596/talkyard-v0202123
  //   https://www.talkyard.io/-589/talkyard-v0202122

  // ----- Other announcements

  // Announcement about HTTPS certificates renewal problem.
  // Only for admins for self hosted sites, created after revision 895b7aa6e2
  // "Code review: Auto https ...", Mars 20, 2021, in talkyard-prod-one.
  const autoLuaCertFromMs = 1616112000 * 1000 // 2021-03-19 00:00:00Z
  const maybeCertBug =
      isSelfHosted() && me.isAdmin && me.siteCreatedAtMs &&
      autoLuaCertFromMs < me.siteCreatedAtMs;
  const certBugAnn: RElm | Nl = !maybeCertBug || isE2eTest ? null :
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

  return (
    r.div({ className: 'c_SrvAnns' },
      // There's [another_maint_msg] in the topbar, visible if you've scrolled down
      // (then, the maint message added here, might have scrolled out of view).
      anyMaintMsg(),
      rFr({}, adminNotices),
      // sampleNotice,
      certBugAnn,
      newTyVersionAnn,
      prevTyVersionAnn,
    ));
}



function ThisShownToAdminsOnly() {
  return r.p({ className: 'c_TBx_WhoSee'}, "(This shown to admins only)");
}


/// This is for everyone. There's one brief maint message  in the topbar,
/// visible if you've scrolled down. And one possibly longer, in an
/// info box at the top of all (?) pages.  Hmm I think I forgot the
/// search engine results page?
///
export function anyMaintMsg(ps: { brief?: true } = {}): RElm | N {
  const maintWork: MaintWork | U = Server.anyMaintWork();
  // Don't cache any maint message in the server side html cache.
  if (!maintWork || isServerSide())
    return null;

  return (
      r.div({ className: 'c_MaintWorkM' }, r.div({ className: 'n_SysMsg_Txt'},
        // The html below has been sanitized server side. [sanit_maint_msg]
        ps.brief
          ? (maintWork.msgLineHtmlSafe
              ? r.div({ dangerouslySetInnerHTML: { __html: maintWork.msgLineHtmlSafe }})
              : rFr({},
                  r.b({}, "Under maintenance"), ", read-only."))  // I18N
          : (maintWork.msgParaHtmlSafe
              ? r.div({ dangerouslySetInnerHTML: { __html: maintWork.msgParaHtmlSafe }})
              : rFr({},
                  r.h1({}, "Under Maintenance"),  // I18N
                  r.p({},
                      "Usually we're done in 5–15 minutes. " +
                      "Until then, you can access the forum in read-only mode.")))
          )));

        /*
          maintWork.untilSecs === 1 ? '' : (
            ` Time left: ${
            Math.max(0, Math.ceil((maintWork.untilSecs * 1000 - Date.now()) / 3600/1000))
            } hours`)));
            r.button({ onClick: () => location.reload() }, "Click here"), " to retry"
            */
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
