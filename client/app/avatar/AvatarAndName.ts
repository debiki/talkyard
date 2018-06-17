/*
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

/// <reference path="avatar.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
   module debiki2.avatar {
//------------------------------------------------------------------------------


export var AvatarAndName = function(
    props: { user: BriefUser, origins: Origins, hideAvatar?: boolean, ignoreClicks?: boolean }) {

  const user: BriefUser = props.user;
  const avatar = props.hideAvatar ?
      null : debiki2.avatar.Avatar({ user, origins: props.origins, ignoreClicks: true });

  // Dupl code, see posts.ts [88MYU2]
  let namePart1;
  let namePart2;
  if (user.fullName && user.username) {
    namePart1 = r.span({ className: 'esAvtrName_username' }, user.username);
    namePart2 = r.span({ className: 'esAvtrName_fullName' }, ' (' + user.fullName + ')');
  }
  else if (user.fullName) {
    namePart1 = r.span({ className: 'esAvtrName_fullName' }, user.fullName);
    namePart2 = r.span({ className: 'esAvtrName_isGuest' }, user.isEmailUnknown ? '??' : '?');
  }
  else if (user.username) {
    namePart1 = r.span({ className: 'esAvtrName_username' }, user.username);
  }
  else {
    namePart1 = r.span({ className: 'esAvtrName' }, '(Unknown author)');
  }
  const onClick = props.ignoreClicks ?
      null : (event) => morebundle.openAboutUserDialog(user.id, event.target);
  return (
      r.span({ className: 'esAvtrName', onClick: onClick },
        avatar, namePart1, namePart2));

};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
