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
      title: "Let's view login settings",
      text: r.span({}, "Click ", r.b({}, "Signup and Login")),
      placeAt: '#e2eAA_Ss_LoginL',
      placeHow: PlaceHow.ToTheRight,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500, /*
      title: "These are the",
      text: rFragment({}, r.b({}, "login and sign up"), " settings."),
      placeAt: 'body',
    }, {
      pauseBeforeMs: 500, */
      title: "Here you can ...",
      text: r.span({}, "... enable or disable anonymous Guest login "),
      placeAt: '.e_A_Ss_S-AllowGuestsCB',
      placeHow: PlaceHow.Below,
      highlightOffsetY: -12,
    }, {
      title: "Let's go here",
      text: r.span({}, "Click the ", r.b({}, "Review"), " tab"),
      placeAt: '.e_RvwB',
      placeHow: PlaceHow.Below,
      waitForClick: true,
    }, {
      pauseBeforeMs: 500,
      title: "People's blog comments ...",
      text: "... will appear here. For you to review and approve.",
      placeAt: 'body',
    }, {
      title: "Let's go back",
      text: r.span({}, "to the embedded comments settings. Click ", r.b({}, "Settings")),
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
    /*
      // This is too much, people get frustrated (well at least one out of two).
      // And most likely, their blog address is correctly typed alread :-P
      pauseBeforeMs: 500,
      title: "For you to do:",
      text: "Check that your blog address is correct",
      placeAt: '#e_AllowEmbFrom',
      placeHow: PlaceHow.Below,
      highlightOffsetX: -90,
      highlightOffsetY: -20,
      highlightPadding: 20,
    }, {
      title: "Thereafter:",
      text: "Follow these instructions",
      placeAt: '.s_A_Ss_EmbCmts h2',
      placeHow: PlaceHow.ToTheLeft,
      highlightOffsetX: -30,
      highlightPadding: 20,
    }, {
      title: "And look here",
      text: "for any special instructions, for your blog.",
      placeAt: '.s_A_Ss_EmbCmts ul',
      placeHow: PlaceHow.Above,
      highlightOffsetX: -110,
      highlightPadding: 7,
    }, {
      title: "That's it, for now",
      text: "Have a nice day",
      placeAt: 'body',
    */
      title: "Follow these instructions",
      text: "And have a nice day",
      placeAt: '.s_A_Ss_EmbCmts h2',
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
      text: "Click later, to go to admin settings.",
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
      placeHow: PlaceHow.ToTheRight,
      highlightOffsetX: -30,
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
      title: "You can create new topics",
      text: "outside any blog post, if you want to use this like a forum",
      placeAt: '#e2eCreateSth',
      placeHow: PlaceHow.ToTheLeft,
      highlightPadding: 17,
    }, {
      title: "Your menu",
      text: r.span({}, "Click your name, ", r.b({}, me.username), ", to open. Now"),
      placeAt: '.esMyMenu',
      placeHow: PlaceHow.ToTheLeft,
      waitForClick: true,
    }, {
      pauseBeforeMs: 300,
      title: "Admin area link",
      text: "If you click it, you'll go to the admin area.",
      placeAt: '.esMyMenu_admin',
      placeHow: PlaceHow.ToTheLeft,
    }, {
      title: "That's it, for now",
      text: "Bye and have a nice day",
      placeAt: 'body',
    }],
  }},

};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
