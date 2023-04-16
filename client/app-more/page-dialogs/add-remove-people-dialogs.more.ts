/*
 * Copyright (c) 2016, 2020 Kaj Magnus Lindberg
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
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;

let addPeopleDialog;


interface SelectListLabelValue {
  label: St;
  value: PatId;
  disabled?: true;
}


/// Specify either:
///   ps.curPats — If specified, those pats are shown in the list, and can
///       then be removed.
/// Or:
///   curPatsIds — If specified, no pats are shown in the list. You can then
///       only *add* pats. (But pats in `curPatsIds` will be disabled in the list
///       to choose from.)
/// Maybe a bit odd? Could some day instead add a `showCurPatsInList: Bo` param?
///
export function openAddPeopleDialog(ps: { curPatIds?: PatId[], curPats?: Pat[],
        onChanges: (res: PatsToAddRemove) => Vo }) {
  if (!addPeopleDialog) {
    addPeopleDialog = ReactDOM.render(AddPeopleDialog(), utils.makeMountNode());
  }
  addPeopleDialog.open(ps);
}


const AddPeopleDialog = createComponent({
  displayName: 'AddPeopleDialog',

  getInitialState: function () {
    return {};
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(ps: { curPatIds?: PatId[], curPats?: Pat[],
            onChanges: (PatsToAddRemove) => Vo }) {
    const selectedLabelValues = !ps.curPats ? [] :
            ps.curPats.map((p: Pat) => {
              return { label: pat_name(p), value: p.id };
            });
    this.setState({
      isOpen: true,
      alreadyAddedIds: ps.curPatIds || ps.curPats && ps.curPats.map(p => p.id) || [],
      selectedLabelValues,
      initialPats: ps.curPats,
      onChanges: ps.onChanges,
    });
  },

  loadUsernameOptions: function(prefix: string,
        callback: (error, result: { options: ReactSelectV1Option[] }) => void) {
    Server.listAllUsernames(prefix, (users: MemberIdName[]) => {
      if (this.isGone || !this.state.isOpen) {
        // Hope it's ok to never call the React-Select callback? Since that component
        // is now gone.
        return;
      }

      // If 1/2 `initialPats`, then React-Select will hide those pats from the
      // options list (since they've been added already), so it works
      // fine to then leave `alreadyAddedIds` empty — and we have to, because
      // there's with the (a bit old) version of React-Select we're using, no way
      // to update the options list, when adding/removing a pat.
      // However if 2/2 it's only possible to add more pats, and none are shown
      // initially in the selected-items list, then we need to disable those
      // already added.
      const alreadyAddedIds = this.state.initialPats ? [] : this.state.alreadyAddedIds;

      const options = makeLabelValues(users, alreadyAddedIds);
      callback(null, { options });
    });
  },

  close: function() {
    this.setState({
        isOpen: false, alreadyAddedIds: null, selectedLabelValues: null, onChanges: null });
  },

  onSelectChange: function(labelsAndValuesOrNull: SelectListLabelValue[] | N) {
    // labelsAndValues is null if the clear-all [x] button pressed
    const selectedLabelValues = labelsAndValuesOrNull || [];
    // React-Select will remove any newly selected items from the options list,
    // no need to update `state.alreadyAddedIds`.
    this.setState({ selectedLabelValues });
  },

  save: function() {
    const state = this.state;
    const userIds: PatId[] = state.selectedLabelValues.map(entry => entry.value);

    const initialPats: Pat[] | U = state.initialPats;
    const initialPatIds: PatId[] | U = initialPats && initialPats.map(p => p.id);

    // If we showed old pats in the list, don't add them again.
    const addPatIds = !initialPatIds ? userIds :
              userIds.filter(id => initialPatIds.indexOf(id) === -1);  // [On2]

    // If we did'nt show old pats, then, wasn't possible to remove any. (Can only add.)
    const removePatIds = !initialPatIds ? [] :
              initialPatIds.filter(id => userIds.indexOf(id) === -1);  // [On2]

    const result: PatsToAddRemove = {
      addPatIds,
      removePatIds,
    };
    this.state.onChanges(result);
    this.close();
  },

  render: function () {
    let content;
    let nothingChanged: Bo | U;
    let initialPats: Pat[] = [];
    if (this.state.isOpen) {
      content =
        r.div({ id: 'e2eAddUsD'},
          rb.ReactSelectAsync({ multi: true, value: this.state.selectedLabelValues,
            placeholder: t.sud.SelectUsers,
            loadOptions: this.loadUsernameOptions,
            onChange: this.onSelectChange }));
      const idsSorted: PatId[] = this.state.selectedLabelValues.map(entry => entry.value);
      idsSorted.sort();
      initialPats = this.state.initialPats || [];
      const initialIdsSorted: PatId[] = initialPats.map(p => p.id);
      initialIdsSorted.sort();
      nothingChanged = _.isEqual(idsSorted, initialIdsSorted);
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, t.sud.SelectUsers)),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.save, id: 'e2eAddUsD_SubmitB',
              disabled: nothingChanged },
            // If we can remove users, use "Save" as button title, instead of "Add users".
            !initialPats.length ? t.sud.AddUsers : t.Save),
          Button({ onClick: this.close }, t.Cancel))));
  }
});


function makeLabelValues(users: MemberIdName[], pageMemberIds: UserId[]): ReactSelectV1Option[] {
  return users.map((user: MemberIdName) => {
    let prettyName = user.username;
    if (user.fullName) {
      prettyName += ' (' + user.fullName + ')';
    }
    // Use [me_isPageMember] instead, in case any group user is in, is a member?
    const alreadyMember =  _.includes(pageMemberIds, user.id);
    if (alreadyMember) {
      prettyName += " — already added";
    }
    return {
      label: prettyName,
      value: user.id,
      disabled: alreadyMember,
    };
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
