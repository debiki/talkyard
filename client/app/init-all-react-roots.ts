/*
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

/// <reference path="../typedefs/react/react.d.ts" />
/// <reference path="sidebar/sidebar.ts" />
/// <reference path="editor/editor.ts" />
/// <reference path="react-elements/comments-toolbar.ts" />
/// <reference path="react-elements/name-login-btns.ts" />
/// <reference path="users/users-page.ts" />
/// <reference path="dialogs.ts" />

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

var ReactRouter = window['ReactRouter'];


export function initAllReactRoots() {
  var adminAppElem = document.getElementById('dw-react-admin-app');
  if (adminAppElem) {
    ReactRouter.run(debiki2.admin.routes(), (Handler) => {
      React.render(Handler({}), adminAppElem);
    });
  }

  var nonExistingPageElem = document.getElementById('dw-non-existing-page');
  if (nonExistingPageElem)
    React.render(debiki2.nopage.NonExistingPage({}), nonExistingPageElem);

  var topbarElem = document.getElementById('dw-react-topbar');
  if (topbarElem)
    React.render(debiki2.reactelements.TopBar({}), topbarElem);

  var sidebarElem = document.getElementById('dw-any-sidebar');
  if (sidebarElem)
    React.render(debiki2.sidebar.Sidebar({}), sidebarElem);

  var commentsToolbarElem = document.getElementById('dw-comments-toolbar');
  if (commentsToolbarElem)
    React.render(debiki2.reactelements.CommentsToolbar({}), commentsToolbarElem);

  debiki2.editor.createEditor();

  var userPageElem = document.getElementById('dw-react-user-page');
  if (userPageElem) {
    ReactRouter.run(debiki2.users.routes(), (Handler) => {
      React.render(Handler({}), userPageElem);
    });
  }

  var createSiteElem = document.getElementById('dw-react-create-site');
  if (createSiteElem) {
    ReactRouter.run(debiki2.createsite.routes(), (Handler) => {
      React.render(Handler({}), createSiteElem);
    });
  }

  createAnyFlagDialog();
  pagedialogs.createAboutUserDialog();
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
