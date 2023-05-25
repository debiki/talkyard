/*
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

/// <reference path="../../reactjs-types.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../oop-methods.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../utils/scroll-into-view.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../widgets.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------


export function CatsOrHomeLink(page: Page, store: Store, forTopbar?: Bo): RElm | Nl {
  // Section pages have no ancestors — instead, they list topics,
  // categores, sub cats. And they're "home" already.
  const isSectionPage = isSection(page.pageRole);
  if (isSectionPage)
    return null;

  // A new category permission: SeeUnlistedTopics? For now:  [staff_can_see]
  const me: Myself = store.me;
  const isUnlisted = _.some(page.ancestorsRootFirst, a => a.unlistCategory);
  const isUnlistedSoHideCats = isUnlisted && !isStaff(me);
  const hasAncestorsCats = nonEmpty(page.ancestorsRootFirst);
  const showCategories =
          hasAncestorsCats &&
          !isUnlistedSoHideCats &&
          settings_showCategories(store.settings, me);

  let catsOrHomeLink: RElm | Nl = null;

  if (showCategories) {
    catsOrHomeLink =
        // RENAME  esTopbar_ancestors  and  s_Tb_Pg_Cs
        r.ol({ className: 'esTopbar_ancestors s_Tb_Pg_Cs' },
          page.ancestorsRootFirst.map((ancestor: Ancestor) => {
            const deletedClass = ancestor.isDeleted ? ' s_Tb_Pg_Cs_C-Dd' : '';
            const catIcon = category_iconClass(ancestor.categoryId, store);  // [4JKKQS20]
            const key = ancestor.categoryId;
            return (
                r.li({ key, className: 's_Tb_Pg_Cs_C' + deletedClass },
                  // RENAME esTopbar_ancestors_link to just s_AncCs_Ln?
                  Link({ className: catIcon + 'esTopbar_ancestors_link btn',
                      // The path is from here, server side: [anc_cat_path].
                      to: ancestor.path },
                  ancestor.title)));
          }));
  }
  else if (page_isInfoPage(page.pageRole) && !forTopbar) {
    // Then skip Home link — looks weird on Info pages; instead, there's
    // typically a topbar custom nav menu just above + site logo home link.
    // But if we've scrolled down, then it's nice with a Home link
    // in the topbar? So, do show, if is for topbar (then skip this noop block).
  }
  else {
    // Show a Home link, so there's somewhere to return to. Dupl code [HOMELN495]
    const mainSiteSection: SiteSection = store_mainSiteSection(store);
    const homePath = mainSiteSection.path;
    catsOrHomeLink =
        r.ol({ className: 'esTopbar_ancestors s_Tb_Pg_Cs' },
          r.li({ key: 'h' },
            Link({ className: 'esTopbar_ancestors_link btn', to: homePath }, t.Home)));
  }

  return catsOrHomeLink;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
