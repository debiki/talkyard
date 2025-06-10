/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
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


///------------------------------------------------------------------------------
  namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function LinkToPatAdminArea(pat: Pat): RElm {
  const usernameElem = !pat.username ? null :
          r.span({ className: 'dw-username' }, pat.username);
  let fullNameElem: RElm | St | U;
  if (pat.fullName) {
    const nameMaybeParens = !usernameElem ? pat.fullName :
            ' (' + pat.fullName + ')';
    fullNameElem = r.span({ className: 'dw-fullname' }, nameMaybeParens);
  }
  else if (!usernameElem) {
    fullNameElem = 'TyE0NAME';
  }
  return Link({ to: linkToUserInAdminArea(pat) }, usernameElem, fullNameElem)
}


export function reviewTask_doneOrGone(reviewTask: ReviewTask): boolean {
  return !!reviewTask.completedAtMs || !!reviewTask.invalidatedAtMs;
}


export interface PrettyDiskStats {
  dbMb: Nr;
  dbMaxMb?: Nr;
  dbPercentStr?: St;
  fsMb: Nr;
  fsMaxMb?: Nr;
  fsPercentStr?: St;
}


export function prettyStats(stats: SiteStats): PrettyDiskStats {
  //const Mega = 1000 * 1000;
  const Mega = Sizes.Mebibyte;

  const dbMb = stats.dbStorageUsedBytes / Mega;
  const dbMaxMb = stats.dbStorageLimitBytes && stats.dbStorageLimitBytes / Mega;
  const dbPercentStr = dbMaxMb && (100 * dbMb / dbMaxMb).toPrecision(2);

  const fsMb = stats.fileStorageUsedBytes / Mega;
  const fsMaxMb = stats.fileStorageLimitBytes && stats.fileStorageLimitBytes / Mega;
  const fsPercentStr = fsMaxMb && (100 * fsMb / fsMaxMb).toPrecision(2);

  return { dbMb, dbMaxMb, dbPercentStr, fsMb, fsMaxMb, fsPercentStr };
}

//------------------------------------------------------------------------------
  }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
