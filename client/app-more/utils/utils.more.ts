/*
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.utils {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function showDefaultFrom(inheritedFrom: Ref | Cat): St | RElm {
  // 0I18N here; this is for staff.
  let fromWhere: St | RElm = '';
  if (_.isString(inheritedFrom)) {
    // Then it's a ref str, e.g. `pageid:1234`.
    if (inheritedFrom.startsWith('pageid:')) fromWhere = ", for this page ";
    if (inheritedFrom.startsWith('catid:')) fromWhere = ", inherited from a category ";
    if (inheritedFrom.startsWith('sstg:')) fromWhere = ", inherited from the site settings ";
    if (inheritedFrom.startsWith('BuiltIn')) fromWhere = ' ';
    fromWhere = rFr({}, fromWhere, r.small({}, `(`, inheritedFrom, `)`));
  }
  else if (inheritedFrom.defaultTopicType) {
    // Then `inheritedFrom` is a category.
    const cat: Cat = inheritedFrom;
    fromWhere =
          rFr({}, `, inherited from category `, r.i({}, cat.name), `. `);
  }
  else {
    // "Cannot" happen.
    fromWhere = `, from where? TyEUNKORG`;
  }

  return rFr({},
          `The default`, fromWhere);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
