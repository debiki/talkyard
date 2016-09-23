/*
 * Copyright (C) 2014-2016 Kaj Magnus Lindberg
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

/// <reference path="../../typedefs/react/react.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;


// The admin guide is placed in the sidebar [8YKFW32], because then it'll be accessible from
// everywhere, and the admin can read & look in the guide at the same time as s/he looks at
// the admin buttons and settings to the left.
//
// Don't add anything more. Because if the text is too long, people won't readit.
//
export var AdminGuide =
  r.div({ className: 'esAdminGuide' },
    r.p({}, "Welcome! You're an admin, so you can edit settings, define what this community is about, and invite people."),
    r.h2({}, "Edit settings"),
    r.p({}, "Go to the admin area by clicking your name to the upper right, then click ", r.strong({}, "Admin"), ". Have a look at the settings, in case there's something you'd like to change. To make the forum private, edit settings in the ", r.strong({}, "Login"), " section. You can edit colors and fonts in the ", r.strong({}, "Customize"), " section."),
    r.h2({}, "Clarify what this community is about"),
    r.p({}, "On ", r.a({ href: "/" }, "the forum main page"), ", edit the forum intro text (just below the forum title). And edit the ", r.em({}, "Welcome to this community"), " topic."),
    r.h2({}, "Create categories"),
    r.p({}, "On ", r.a({ href: "/" }, "the forum main page"), ", click ", r.strong({}, "Categories"), ", then ", r.strong({}, "Create Category"), ". Edit the about-this-category topic that you'll find in each category you create. Don't create too many categories (if you do, they might look rather empty)."),
    r.h2({}, "Build your community"),
    r.p({}, "Building a community is hard. Before launching:"),
    r.ul({},
      r.li({}, "Make sure people will understand what this community is about — see the ", r.em({}, "Clarify what this community is about"), " section above."),
      r.li({}, "Create some interesting topics, so people won't find an empty forum."),
      r.li({}, "Set aside time to visit your forum regularly and participate in the discussions."),
      r.li({}, "Tell a few people to have a look at your forum. Ask if they understand its purpose. Edit the forum intro text and the welcome topic, until everything is clear.")),
    r.p({}, "Then start promoting your community: link to it on the Internet, and tell people about it. You can invite people via email: go to the Admin Area, click ", r.strong({}, "Users"), ", then ", r.strong({}, "Invite"), "."),
    r.h2({}, "Need help?"),
    r.p({}, "For help, go to EffectiveDiscussion's ", r.a({ href: 'http://www.effectivediscussions.org/forum/latest/support', target: '_blank' }, "support forum", r.span({ className: 'icon-link-ext' })), ". Over there, there's an ", r.em({}, "Ideas"), " category too, and you're welcome to make suggestions."));

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
