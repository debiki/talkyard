/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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


export const PseudonymsAllowedDrpBtn = function(props: DiscLayoutDropdownBtnProps): RElm {
  const nevAlwProps: NeverAlwaysProps = {
    getVal: (p: DiscPropsSource) => p.pseudonymsAllowed,
    setVal: (p: DiscPropsSource, val: NeverAlways) => { return { ...p, pseudonymsAllowed: val }},
    mkDiagTitle,
    mkItemDescr,
    e2eClass: 'e_PseudonAlwD',
  };

  return NeverAlwaysBtn({ ...props, ...nevAlwProps });
}


function mkDiagTitle(forCat: Bo | U): St | RElm {
  return (forCat
              ? rFr({}, `Pseudonyms, in this category: `, // 0I18N, is for staff
                  r.small({ style: { marginLeft: '1ex' }},
                    `(and subcategories)`))
              : `Pseudonyms, on this page`);
}


function mkItemDescr(nevAlw: NeverAlways, defaultFrom: DiscPropsComesFrom): St | RElm | N {
  // 0I18N here; this is for staff.
  switch (nevAlw) {
    case NeverAlways.Inherit:
      return utils.showDefaultFrom(defaultFrom.pseudonymsAllowed);

    case NeverAlways.NeverButCanContinue:
      return "People can't use pseudonyms (pen names) here.";

    case NeverAlways.Allowed:
      return `People use their real accounts, by default. But if anyone wants, ` +
              `they can use a pseudonym, when posting and replying here.`;

    case NeverAlways.Recommended:
      return `People use pseudonyms, by default. ` +
              `One can still chooose to use one's real account.`;

    case NeverAlways.AlwaysButCanContinue:
      return "Everyone has to use pseudonyms.";

    default:
      return null;
  }
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
