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

/// <reference path="../prelude.ts" />
/// <reference path="../widgets.ts" />
/// <reference path="../utils/utils.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export function Tag(ps: { tag?: Tag, tagType: TagType,
      onClickDropdown?: Bo, isBookmark?: Bo, isForPat?: Bo, me: Me }): RElm {
  const tag: Tag | U = ps.tag;
  const tagType = ps.tagType;
  const patOrPostClass = ps.isForPat ? ' c_Tag-Pat' : ' c_Tag-Po';
  const bookmarkTagClass = ps.isBookmark ? ' c_Tag-Bo' : '';
  const bookmarkIconClass = ps.isBookmark ? ' icon-bookmark' : '';
  const tagName = tagType.dispName ||
            // In case there's some bug so the tag type wasn't found.
            `tag_id: ${tag.id} tag_type: ${tag.tagTypeId}`;

  const tagVal = tag && tag_getVal(tag, tagType);
  const hasVal = isVal(tagVal);
  const anyColon = !hasVal ? null : r.span({ className: 'c_Tag_Col' }, ': ');
  const anyValue = !hasVal ? null : r.span({ className: 'c_Tag_Val' }, tagVal);

  // An edit-value or remove-tag dropdown doesn't currently make sense, for tag types (`!tag`).
  dieIf(ps.onClickDropdown && !tag, 'TyE603MRGL4');

  const onClick = !ps.onClickDropdown ? undefined : (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const atRect = cloneEventTargetRect(event);
    morebundle.openTagDropdown(atRect, { tag, tagName, tagType, anyValue, me: ps.me });
  };

  // Either an  <a href ... onclick=openTagDropdown()...>,  or a  <Link to=...>.
  const linkFn = onClick ? r.a : LinkUnstyled;
  let href = UrlPaths.Tags + tagType.id;
  let to = onClick ? undefined : href;
  if (!onClick) href = undefined;

  return (
      linkFn({ className: 'c_Tag c_TagL_Tag' + patOrPostClass + bookmarkTagClass,
            href, onClick, to,
            onKeyDown: (event) => {
              // Without this, only Enter (not Space) triggers onClick (in Chrome, my laptop).
              if (onClick && event_isSpace(event)) onClick(event);
            }
           },
        r.span({ className: 'c_Tag_Name' + bookmarkIconClass},
          tagName),
        anyColon,
        anyValue));
}


/** Might return undefined, also if the tag type wants a tag value — maybe
   * the type was altererd (to want a value), after the tag had been created.
   *
   * Also see the [detailed_tag_val_types] in ../../../tests/e2e-wdio7/pub-api.ts .
   */
export function tag_getVal(tag: Tag, tagType: TagType): Nr | St | U {
  switch (tagType.valueType) {
    case TypeValueType.Int32: return tag.valInt32;
    case TypeValueType.Flt64: return tag.valFlt64;
    case TypeValueType.StrKwd: return tag.valStr;
  }
  return undefined;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
