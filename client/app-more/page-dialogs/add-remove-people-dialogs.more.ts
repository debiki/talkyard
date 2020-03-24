/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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


export function openAddPeopleDialog(alreadyAddedIds: UserId[],
      onDone: (newIds: UserId[]) => void) {
  if (!addPeopleDialog) {
    addPeopleDialog = ReactDOM.render(AddPeopleDialog(), utils.makeMountNode());
  }
  addPeopleDialog.open(alreadyAddedIds, onDone);
}


const AddPeopleDialog = createComponent({
  displayName: 'AddPeopleDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      selectedLabelValues: [],
    };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(alreadyAddedIds: UserId[], onDone: (newIds: UserId[]) => void) {
    this.setState({
      isOpen: true,
      isLoading: true,
      alreadyAddedIds,
      onDone,
    });
    Server.listAllUsernames('', (allUsers: MemberIdName[]) => {
      if (this.isGone || !this.state.isOpen) return;
      this.setState({
        selectedLabelValues: [],
        allUsers,
        isLoading: false,
      });
    });
  },

  close: function() {
    this.setState({ isOpen: false, alreadyAddedIds: null, onDone: null });
  },

  onSelectChange: function(labelsAndValues: any) {
    // labelsAndValues is null if the clear-all [x] button pressed
    this.setState({ selectedLabelValues: labelsAndValues || [] });
  },

  save: function() {
    const userIds = this.state.selectedLabelValues.map(entry => entry.value);
    this.state.onDone(userIds);
    this.close();
  },

  render: function () {
    if (this.state.isLoading)
      return r.p({}, t.Loading);

    let content;
    if (this.state.isOpen) {
      content =
        r.div({ id: 'e2eAddUsD'},
          rb.ReactSelect({ multi: true, value: this.state.selectedLabelValues,
            placeholder: t.sud.SelectUsers,
            options: makeLabelValues(this.state.allUsers, this.state.alreadyAddedIds),
            onChange: this.onSelectChange }));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, t.sud.SelectUsers)),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.save, id: 'e2eAddUsD_SubmitB',
              disabled: !this.state.selectedLabelValues.length }, t.sud.AddUsers),
          Button({ onClick: this.close }, t.Cancel))));
  }
});


function makeLabelValues(users: MemberIdName[], pageMemberIds: UserId[]) {
  return users.map((user: MemberIdName) => {
    let prettyName = user.username;
    if (user.fullName) {
      prettyName += ' (' + user.fullName + ')';
    }
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
