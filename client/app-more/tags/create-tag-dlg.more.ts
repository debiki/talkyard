/*
 * Copyright (c) 2021 Kaj Magnus Lindberg
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


/// <reference path="../more-prelude.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;



type NewTagTypeCallback = (_: TagType) => Vo;
let pub_setOnCreatedCallback: (_: [NewTagTypeCallback]) => Vo;

export function openCreateTagDialog(onCreated: NewTagTypeCallback) {
  // We need the editor-bundle.js; it contains window.debikiSlugify [5FK2W08].
  Server.loadEditorAndMoreBundles(() => {
    if (!pub_setOnCreatedCallback) {
      ReactDOM.render(CreateTagTypeDialog(), debiki2.utils.makeMountNode());
    }
    pub_setOnCreatedCallback([onCreated]);
  });
}


const CreateTagTypeDialog = React.createFactory<{}>(function() {
  const [onCreatedCallback, setOnCreatedCallback] =
          React.useState<[NewTagTypeCallback]>(null);
  const [dispName, setDispName] = React.useState<ValueOk<St>>({});

  // For now, just posts.
  const [canTagWhat, setCanTagWhat] = React.useState<ValueOk<ThingType>>({
    // Dropdown/checkbox to selet what can be tagged? [.or_badge_or_tag] [missing_tags_feats]
    value: ThingType.Posts,
    isOk: true,
  });
  pub_setOnCreatedCallback = setOnCreatedCallback;

  const isOpen = !!onCreatedCallback;

  function serverCreateTagType() {
    const newTagType: TagType = {
      id: No.TagTypeId as TagTypeId,
      dispName: dispName.value,
      urlSlug: window['debikiSlugify'](dispName.value),
      canTagWhat: canTagWhat.value,
    };
    Server.upsertType(newTagType, (newTagTypeWithId: TagType) => {
      onCreatedCallback?.[0](newTagTypeWithId);
      setOnCreatedCallback(null);
      // Show the type details page — that's currently the only place where type props
      // other than the title can be edited (this Create Tag dialog is a bit simplistic).
      page.Hacks.navigateTo(  // we're outside the main React root
            linkToType(newTagTypeWithId));
    });
  }

  let contents: RElm | U;
  let saveCancel: RElm | U;

  if (isOpen) {
    contents = rFr({},
        // Hmm, new input type needed? (Using FullNameInput is a bit odd?)
        util.FullNameInput({ label: "Tag name:", className: 'e_CrTagD_Un', tabIndex: 1,  // I18N
          defaultValue: '',
          onChangeValueOk: (value, isOk) => setDispName({ value, isOk })
        }),
        r.p({}, "You can customize the tag more, once you've created it."),  // I18N
        );

    const allFine = dispName.isOk && canTagWhat.isOk;
    saveCancel = rFr({},
      PrimaryButton({ onClick: () => serverCreateTagType(), disabled: !allFine }, "Create"), // I18N
      Button({ onClick: () => setOnCreatedCallback(null) }, t.Cancel));
  }

  return (
      Modal({ show: isOpen, onHide: () => setOnCreatedCallback(null), dialogClassName: 's_CrTagD' },
        ModalHeader({}, ModalTitle({}, "Create Tag")),  // [.or_badge_or_tag]  I18N
        ModalBody({}, contents),
        ModalFooter({}, saveCancel)));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------