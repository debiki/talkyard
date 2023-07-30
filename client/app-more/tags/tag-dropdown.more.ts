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
/// <reference path="../morekit/proxy-diag.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ExplainingListItem = util.ExplainingListItem;


export function openTagDropdown(atRect, ps: {  // I18N tag menu
      tag?: Tag, tagName: St, tagType: TagType, anyValue?, me: Me }) {
  const imStaff = pat_isStaff(ps.me);
  const tagType = ps.tagType;
  // Currently searching by id works too, because not all tag types have url slugs,
  // and tag names might include spaces  [search_q_param_space]
  // — so the server looks up by id (after first trying by slug).
  const slugOrId = tagType.urlSlug || tagType.id;
  morekit.openProxyDiag({ atRect, flavor: DiagFlavor.Dropdown,
            dialogClassName: 'c_TagDrpdD' }, closeDiag => rFr({},
    r.div({ className: 'esDropModal_header' },
        `Tag: `, r.samp({ className: 'c_Tag' }, ps.tagName)),
    r.ul({},
      ExplainingListItem({
          title: `View tag`,
          linkTo: UrlPaths.Tags + slugOrId,
          text: `Read about this tag`,
          onNav: closeDiag,
          }),
      ExplainingListItem({
          title: rFr({}, `Search for tag`),
          linkTo: UrlPaths.SearchQ + `tags:${slugOrId}`,
          text: `List posts with this tag`,
          onNav: closeDiag,
          }),
      !imStaff || !(tagType.wantsValue >= NeverAlways.Allowed) ? null : ExplainingListItem({
          title: isVal(ps.anyValue) ? `Edit tag value` : `Set tag value`,
          text: !isVal(ps.anyValue) ? null :
                    rFr({}, `Current value: `, r.samp({}, ps.anyValue)),
          onSelect: () => {
            morekit.openProxyDiag({ atRect }, closeDiag => {
              return TagValEditor({
                  tag: ps.tag, tagType, closeParent: closeDiag });
            });
          } }),
      !imStaff ? null : ExplainingListItem({
          title: "Remove tag",
          text: null,
          onSelect: () => {
            morekit.openProxyDiag({ atRect, closeOnButtonClick: true }, () => rFr({},
                r.p({}, "Remove tag?"),
                r.div({ className: 'c_DlgBtns' },
                    Button({}, "No, cancel"),
                    PrimaryButton({ onClick: () => {
                      // Will this upd the post? Depends! If rendered via the store, yes.
                      // Otherwise, not without page reload.  UX BUG, minor.
                      Server.updateTags({ remove: [ps.tag] });
                    }}, "Yes, delete"))));
          } }),
      )));
}


function tag_copySetVal(tag: Tag, tagType: TagType, newVal: Nr | St): Tag {
  const copy: Tag = { ...tag, valType: tagType.valueType };
  // If the tag type was modified so now the value is of a different type,
  // delete any old value — we don't want e.g. both valStr and valInt32 present
  // at the same time.
  delete copy.valInt32;
  delete copy.valFlt64;
  delete copy.valStr;
  // Maybe cast tag to the [detailed_tag_val_types] in ../../../tests/e2e-wdio7/pub-api.ts
  // to reduce bug risk? Could do later, if adding more "complicated" tag value types.
  switch (tagType.valueType) {
    case TypeValueType.Int32:
      dieIf(!_.isNumber(newVal), 'TyEVAL0NUM');
      dieIf(Math.floor(newVal as Nr) !== newVal, 'TyEVAL0INT');
      copy.valInt32 = newVal as Nr;
      break;
    case TypeValueType.Flt64:
      dieIf(!_.isNumber(newVal), 'TyEVAL0FLT');
      copy.valFlt64 = newVal as Nr;
      break;
    case TypeValueType.StrKwd:
      dieIf(!_.isString(newVal), 'TyEVAL0STR');
      copy.valStr = newVal as St;
      break;
    default:
      die('TyEUNKVALTYP025');
  }
  return copy;
}


const TagValEditor = React.createFactory<{ tag: Tag, tagType: TagType,  // I18N
        closeParent: () => V }>(function(props) {
  const tagType = props.tagType;
  const tag = props.tag;
  const origVal = tag_getVal(tag, tagType);
  const [newValue, setNewValue] = React.useState<Nr | St | U>(origVal);
  let help: St;
  let step: Nr | U;
  let pattern: St | U;
  let parseFn;
  let type;
  switch (tagType.valueType) {
    case TypeValueType.Int32:
      help = "Type an integer number.";
      step = 1; // (See: [odd_num_input])
      parseFn = parseInt;
      // Fall through.
    case TypeValueType.Flt64:
      help ||= "Type a number.";
      parseFn ||= parseFloat;
      type = 'number';
      break;
    case TypeValueType.StrKwd:
      help = `Type a word (or a few)`;
      parseFn = (x: A) => x;
      // (Skip type — the default is text.)
      break;
    default:
      die(`Unknown value type: ${tagType.valueType} [TyEUNKVALTYP026]`);
  }

  const valueInput = debiki2.Input({ type, className: '', label: `New value:`, help,
      value: newValue || '', step, pattern, onChange: (event) => {
        const newValue = parseFn(event.target.value);
        setNewValue(newValue);
      }});

  return rFr({},
      r.p({}, "Current value: ", isVal(origVal) ? r.samp({}, origVal) : "(None)"),
      valueInput,
      r.div({ className: 'c_DlgBtns' },
          Button({ onClick: props.closeParent }, t.Cancel),
          !isVal(newValue) ? null : PrimaryButton({ onClick: () => {
            // UX BUG SHOULD update the post, also if it's not in the store, e.g. if
            // looking at all posts with a certain tag — but currently one needs
            // to reload to see the changes.
            const editedTag: Tag = tag_copySetVal(tag, tagType, newValue);
            Server.updateTags({ edit: [editedTag] }, props.closeParent);
          }}, t.Save)));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------