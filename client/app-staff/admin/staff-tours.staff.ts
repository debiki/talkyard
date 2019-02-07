/*
 * Copyright (c) 2019 Kaj Magnus Lindberg
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

/// <reference path="../staff-prelude.staff.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const staffTours: StaffTours = {
  adminArea: function(me: Myself) { return {
    id: 'aa',  // for Admins, the Admin area
    forWho: me,
    steps: [{
      doBefore: () => {
        // The sidebar can occlude things, if screen narrow.
        debiki2.sidebar.contextBar.closeSidebar();
      },
      pauseBeforeMs: 1000,
      title: "This is the Admin Area",
      text: "It's for staff only",
      placeAt: 'body',
    }, {
      title: "Let's view login settings",
      text: r.span({}, "Click ", r.b({}, "Signup and Login")),
      placeAt: '#e2eAA_Ss_LoginL',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, {
      pauseBeforeMs: 400,
      title: "Here you can ...",
      text: r.span({}, "... make this community ", r.b({}, "private")),
      placeAt: '.e_A_Ss_S-LoginRequiredCB',
      placeHow: PlaceHow.Below,
      highlightOffsetX: 20,
      highlightOffsetY: 3,
    }, {
      title: "Let's go here",
      text: r.span({}, "Click the ", r.b({}, "Review"), " tab"),
      placeAt: '.e_RvwB',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "Later, new members' ...",
      text: "... first posts are shown here. So you can " +
          "check that they are okay.",
      placeAt: 'body',
    }, {
      title: "One last thing",
      text: r.span({}, "Click the ", r.b({}, "Users"), " tab"),
      placeAt: '.e_UsrsB',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "You can invite people",
      text: r.span({}, "Click ", r.b({}, "Invite"), " above, please"),
      placeAt: '.e_InvitedUsB',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "Here you can invite people",
      text: "to your community",
      placeAt: 'body',
    }, {
      doBefore: () => {
        debiki2.sidebar.contextBar.openSidebar();
        debiki2.sidebar.contextBar.showAdminGuide();
      },
      pauseBeforeMs: 700,
      title: "Look, an admin guide",
      text: "For you.",
      placeAt: '.esCtxbar_list_title',
      placeHow: PlaceHow.ToTheLeft,
      highlightOffsetX: -30,
    }, {
      title: "That's it, for now",
      text: "Have a nice day.",
      placeAt: 'body',
    }],
  }},
  forum: function(me: Myself) { return {
    id: 'af',  // for Admins, the Forum section
    forWho: me,
    steps: [{
      doBefore: () => {
        // The sidebar can occlude things, if screen narrow.
        debiki2.sidebar.contextBar.closeSidebar();
      },
      pauseBeforeMs: 500,
      title: `Welcome, ${me.fullName || me.username}!`,
      text: "Let me show you around",
      nextTitle: "Okay",
      placeAt: 'body',
    }, {
      title: "This is the intro text",
      text: "It tells people what they can do here",
      placeAt: '.esForumIntro p',
      placeHow: PlaceHow.Below,
      highlightOffsetX: -50,
    }, {
      title: "You can edit the intro text",
      text: r.span({}, "by clicking ", r.b({}, "Edit"), ". Later, not now."),
      placeAt: '.esForumIntro_edit',
      placeHow: PlaceHow.Below,
    }, {
      title: "The welcome topic",
      text: "Later, click and edit this topic, too",
      placeAt: '.e2eTopicTitle [href]',
      placeHow: PlaceHow.ToTheRight,
      highlightOffsetX: 5,
    }, {
      title: "Go to categories",
      text: r.span({},
        "Click ", r.b({ style: { textDecoration: 'underline' }}, "Categories"), " above, now"),
      placeAt: '.esForum_navLink',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {
      pauseBeforeMs: 600,
      title: "The Categories page",
      text: "Here you see all categories. (That is, groups of topics about the same thing)",
      placeAt: 'body',
    }, {
      title: "You can create categories",
      text: "by clicking here. Not now. Later.",
      placeAt: '#e2eCreateCategoryB',
      placeHow: PlaceHow.ToTheLeft,
      highlightPadding: 20,
    }, {
      title: "Your menu",
      text: r.span({}, "Click your name, ", r.b({}, me.username), ", to open. Now"),
      placeAt: '.esMyMenu',
      placeHow: PlaceHow.ToTheLeft,
      waitForClick: true,
    }, {
      pauseBeforeMs: 200,
      title: "Admin area link",
      text: "Click now, to go to the admin area.",
      placeAt: '.esMyMenu_admin',
      placeHow: PlaceHow.ToTheLeft,
      waitForClick: true,
    }],
  }},
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
