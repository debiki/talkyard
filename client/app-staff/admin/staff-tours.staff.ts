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


function closeSidebarFn() {
  // The sidebar can occlude things, if screen narrow.
  debiki2.sidebar.contextBar.closeSidebar();
}

function displayName(me: Myself): string {
  return me.fullName || me.username;
}


export const staffTours: StaffTours = {
  adminAreaIntroForCommunity: function(me: Myself) { return {
    id: 'a_c_a',  // 'a'dmin area intro, for a 'c'ommunity, for 'a'dmins
    forWho: me,
    steps: [{
      doBefore: closeSidebarFn,
      pauseBeforeMs: 1000,
      title: "This is the Admin Area",
      text: "It's for staff only",
      placeAt: 'body',
    }, {
      title: rFragment({}, "Click ", r.i({}, "Signup and Login")),
      text: '',
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
    /* Skip this. The tour is too long already; some people exit before it ends.
       And looking at the reviews page, is not so meaningful now, in the beginning,
       when it's empty.
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
      */
    }, {
      title: rFragment({}, "Click ", r.i({}, "Users")),
      text: '',
      placeAt: '.e_UsrsB',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: rFragment({}, "Click ", r.i({}, "Invite"), ", above"),
      text: "You can invite people",
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
      text: "For you. — Goodbye, have a nice day.",
      placeAt: '.esCtxbar_list_title',
      placeHow: PlaceHow.ToTheLeft,
      highlightOffsetX: -30,
    }],
  }},

  adminAreaIntroForBlogComments: function(me: Myself) { return {
    id: 'a_b_a',  // 'a'dmin area intro, for 'b'log comments, for 'a'dmins
    forWho: me,
    steps: [{
      doBefore: closeSidebarFn,
      pauseBeforeMs: 700,
      title: `Welcome, ${displayName(me)}`,
      text: "Let me show you around?",
      placeAt: 'body',
    }, {
      title: rFragment({}, "Click ", r.i({}, "Signup and Login")),
      text: '',
      placeAt: '#e2eAA_Ss_LoginL',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "Here you can ...",
      text: "... enable or disable anonymous Guest login",
      placeAt: '.e_A_Ss_S-AllowGuestsCB',
      placeHow: PlaceHow.Below,
      highlightOffsetY: -12,
    }, {
      title: rFragment({}, "Click ", r.i({}, "Review")),
      text: '',
      placeAt: '.e_RvwB',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "People's blog comments ...",
      text: "... will appear here. For you to review and approve.",
      placeAt: 'body',
    }, {
      title: rFragment({}, "Click ", r.i({}, "Settings")),
      text: "we'll go back to the embedded comments settings",
      placeAt: '.e_StngsB',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {  /*
      // This opens automatically now [5RKTF29]
      title: "Then click Embedded Comments",
      text: '',
      placeAt: '#e2eAA_Ss_EmbCmtsL',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, { */
      title: "Now continue here",
      text: "And have a nice day",
      placeAt: '.s_A_Ss_S-WhichBlog h2',
      placeHow: PlaceHow.ToTheLeft,
      highlightOffsetX: -30,
      highlightPadding: 20,
    }],
  }},

  forumIntroForCommunity: function(me: Myself) { return {
    id: 'f_c_a',  // 'f'orum intro tour, for a 'c'ommuntiy, for 'a'dmins
    forWho: me,
    steps: [{
      doBefore: closeSidebarFn,
      pauseBeforeMs: 500,
      title: `Welcome, ${displayName(me)}`,
      text: "Let me show you around?",
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
      text: '',
      placeAt: '.esForumIntro_edit',
      placeHow: PlaceHow.Below,
    }, {
      title: rFragment({},
        "Click ",
        r.b({ style: { textDecoration: 'underline' }}, t.fb.ViewCategories),
        " below"),
      text: "Now, please",
      placeAt: '.esForum_navLink',
      placeHow: PlaceHow.Above,
      waitForClick: true,
    }, {
      title: "You can create categories",
      text: rFragment({}, r.i({}, "Categories"), " are groups of topics about the same thing."),
      placeAt: '#e2eCreateCategoryB',
      placeHow: PlaceHow.ToTheLeft,
      highlightPadding: 20,
    }, {
      title: rFragment({}, "Click your name: ", r.b({}, me.username)),
      text: "Click now. To open your personal menu",
      placeAt: '.esMyMenu',
      placeHow: PlaceHow.ToTheLeft,
      waitForClick: true,
    }, {
      pauseBeforeMs: 200,
      title: "Admin Area",
      text: rFragment({}, "Go there, to configure settings.", r.br(), r.br(),
          "Bye for now."),
      placeAt: '.esMyMenu_admin',
      placeHow: PlaceHow.ToTheLeft,
      // waitForClick: true, — no, better if people do later, when they
      // are done exploring the forum topics. Otherwise, the whole tour,
      // forum + admin area, would be like 10 + 10 steps = too much.
    }],
  }},

  forumIntroForBlogComments: function(me: Myself) { return {
    id: 'f_b_a',  // 'f'orum intro tour, for 'b'log comments, for the 'a'dmin
    forWho: me,
    steps: [{
      doBefore: closeSidebarFn,
      pauseBeforeMs: 700,
      title: "Welcome! To the discussions list",
      text: "Let me show you around?",
      placeAt: 'body',
    }, {
      title: "Here, there'll be one topic",
      text: "... for each blog post that got one or more comments",
      placeAt: '.s_F_Ts',
      placeHow: PlaceHow.Below,
      highlightPadding: 15,
      highlightOffsetX: -30,
      highlightOffsetY: 20,
    }, {
      title: "This button ...",
      text: "shows blog posts with recent comments, first",
      placeAt: '#e2eSortLatestB',
      placeHow: PlaceHow.Below,
    }, {
      title: "And this ...",
      text: "shows blog posts with many upvoted comments, first",
      placeAt: '#e2eSortTopB',
      placeHow: PlaceHow.Below,
    }, {
      title: r.span({}, "Click your name: ", r.b({}, me.username)),
      text: "Click now. To open your personal menu",
      placeAt: '.esMyMenu',
      placeHow: PlaceHow.ToTheLeft,
      waitForClick: true,
    }, {
      pauseBeforeMs: 300,
      title: "Admin area",
      text: rFragment({}, "Go there, to configure settings.", r.br(), "Bye for now."),
      placeAt: '.esMyMenu_admin',
      placeHow: PlaceHow.ToTheLeft,
    }],
  }},

};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
