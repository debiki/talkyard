/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


// The admin guide is placed in the sidebar [8YKFW32], because then it'll be accessible from
// everywhere, and the admin can read & look in the guide at the same time as s/he looks at
// the admin buttons and settings to the left.
//
// Don't add anything more. Because if the text is long, people tend to skip it completely.
//
export var AdminGuide =
  r.div({ className: 'esAdminGuide' },
    r.p({},
      "You're an admin, so you can edit settings, define what this community is about, " +
      "and invite people. Welcome!"),
    // Not yet implemented:  [2ABKR05L]
    // "You can edit colors and fonts in the ", r.strong({}, "Look and Feel"), " section."),
    r.h2({},
      "Edit settings"),
    r.p({},
      "In the admin area, look at the ", r.b({}, "Settings"),
      " tab — maybe there's something you'd like to change? " +
      "To make the forum private, edit the ", r.strong({}, "Signup and Login"), " settings."),
    r.h2({},
      "Welcome your members"),
    r.p({},
      "Click ", r.b({}, "Back from admin area"), " at the top. " +
      "Then, edit the intro text, just below the main title. And edit the ",
      r.em({}, "Welcome to this community"), " topic."),
    r.h2({},
      "Create categories"),
    r.p({},
      "Click ", r.strong({}, "Categories"),
      ", then ", r.strong({}, "Create Category"),
      ". Edit the ", r.i({}, "description-of-this-category"),
      " topic you'll find in your new category. " +
      "Don't create too many categories — if you do, they might look rather empty. " +
      "Also, create some interesting topics, so people won't find an empty forum. "),
    r.h2({},
      "Launch your community"),
    r.p({},
      "Ask some people to have a look at your community. " +
      "See if they understand what it is about and what they can do here."),
    r.p({},
      "Then start promoting your community: link to it on the Internet, and tell people about it. " +
      "Invite people via email: go to the Admin Area, click ", r.strong({}, "Users"),
      ", then ", r.strong({}, "Invite"), "."),
    r.h2({},
      "Need help?"),
    r.p({},
      "For help, go to Talkyard's ",
      r.a({ href: 'http://www.talkyard.io/forum/latest/support', target: '_blank' },
        r.b({}, "support forum"), r.span({ className: 'icon-link-ext' })), '.'));

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
