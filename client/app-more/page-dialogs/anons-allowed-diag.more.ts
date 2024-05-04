/*
 * Copyright (c) 2023, 2024 Kaj Magnus Lindberg
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
/// <reference path="../utils/utils.more.ts" />
/// <reference path="./never-alwas-diag.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

export function openAnonsAllowedDiag(ps: DiscLayoutDiagState) {
  openNeverAlwaysDiag(ps,
        (p: DiscPropsSource) => p.comtsStartAnon,
        (p: DiscPropsSource, val: NeverAlways) => { return { ...p, comtsStartAnon: val }},
        anonNeverAlways_title,
        anonNeverAlways_descr,
        'e_AnonComtsD');
}


function anonNeverAlways_title(forCat: Bo | U): St | RElm {
  return (forCat
              ? rFr({}, `Anonymous comments, in this category: `, // 0I18N, is for staff
                  r.small({ style: { marginLeft: '1ex' }},
                    `(and subcategories)`))
              : `Anonymous comments, on this page`);
}


function anonNeverAlways_descr(nevAlw: NeverAlways, defaultFrom: DiscPropsComesFrom): St | RElm | N {
  // 0I18N here; this is for staff.
  switch (nevAlw) {
    case NeverAlways.Inherit:
      return utils.showDefaultFrom(defaultFrom.comtsStartAnon);

    case NeverAlways.NeverButCanContinue:
      return "People cannot post anonymously here.";

    case NeverAlways.Allowed:
      return `If anyone wants, they can choose to be anonymous. By default, ` +
              `though, one's real account is used.`;

    case NeverAlways.Recommended:
      return `People are anonymous, by default. ` +
              `One can still chooose to use one's real account.`;

    case NeverAlways.AlwaysButCanContinue:
      return "Everyone is anonymous.";

    default:
      return null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
