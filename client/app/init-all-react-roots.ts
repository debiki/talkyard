/*
 * Copyright (c) 2014, 2017 Kaj Magnus Lindberg
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

/// <reference path="widgets.ts" />
/// <reference path="sidebar/sidebar.ts" />
/// <reference path="watchbar/watchbar.ts" />
/// <reference path="page/metabar.ts" />
/// <reference path="react-elements/name-login-btns.ts" />
/// <reference path="more-bundle-already-loaded.d.ts" />
/// <reference path="staff-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


export function startRemainingReactRoots() {
  const isEmbeddedComments: boolean = debiki.internal.isInEmbeddedCommentsIframe;

  const adminAppElem = document.getElementById('dw-react-admin-app');
  if (adminAppElem)
    ReactDOM.render(
        Router({}, admin.routes()), adminAppElem);

  const superAdminAppElem = document.getElementById('theSuperAdminApp');
  if (superAdminAppElem)
    ReactDOM.render(
        Router({}, superadmin.routes()), superAdminAppElem);

  const tagsAppElem = document.getElementById('theTagsApp');
  if (tagsAppElem)
    ReactDOM.render(
        Router({}, tags.routes()), tagsAppElem);

  const nonExistingPageElem = document.getElementById('dw-non-existing-page');
  if (nonExistingPageElem)
    ReactDOM.render(
        nopage.NonExistingPage({}), nonExistingPageElem);

  const topbarElem = document.getElementById('theTopbar');
  if (topbarElem && !isEmbeddedComments)
    ReactDOM.render(
        reactelements.TopBar({}), topbarElem);

  if (!isEmbeddedComments) {
    createSidebar();
    watchbar.createWatchbar();
  }

  const userPageElem = document.getElementById('dw-react-user-page');
  if (userPageElem) {
    ReactDOM.render(
        // .routes() always available, because the more-bundle.js is loaded on non-pages. [5WKE24]
        Router({}, users.routes()), userPageElem);
  }

  let searchPageElem = document.getElementById('t_SearchPage');
  if (searchPageElem) {
    ReactDOM.render(
        // .routes() always available, because the more-bundle.js is loaded on non-pages. [5WKE24]
        Router({}, debiki2['search'].routes()), searchPageElem);
  }

  const createSiteElem = document.getElementById('dw-react-create-site');
  if (createSiteElem) {
    ReactDOM.render(
        Router({}, createsite.routes()), createSiteElem);
  }
}


export function createSidebar() {
  const sidebarElem = document.getElementById('dw-any-sidebar');
  if (sidebarElem)
    sidebar.createContextbar(sidebarElem);
}


export function removeSidebar() {
  ReactDOM.unmountComponentAtNode(document.getElementById('dw-any-sidebar'));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
