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

/// <reference path="../slim-bundle.d.ts" />
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


export function openAddPeopleDialog() {
  if (!addPeopleDialog) {
    addPeopleDialog = ReactDOM.render(AddPeopleDialog(), utils.makeMountNode());
  }
  addPeopleDialog.open();
}


var AddPeopleDialog = createComponent({
  displayName: 'AddPeopleDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      selectedLabelValues: [],
    };
  },

  componentWillMount: function() {
    this.isUnmounted = false;
  },

  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  open: function() {
    this.setState({
      isOpen: true,
      isLoading: true,
      store: ReactStore.allData(),
    });
    Server.listAllUsernames('', users => {
      if (this.isUnmounted || !this.state.isOpen) return;
      this.setState({
        selectedLabelValues: [],
        allUsers: users,
        isLoading: false,
      });
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  onSelectChange: function(labelsAndValues: any) {
    // labelsAndValues is null if the clear-all [x] button pressed
    this.setState({ selectedLabelValues: labelsAndValues || [] });
  },

  save: function() {
    var userIds = this.state.selectedLabelValues.map(entry => entry.value);
    Server.addUsersToPage(userIds, () => {
      if (this.isUnmounted) return;
      this.close();
      util.openDefaultStupidDialog({ body: "Now I've added him/her/them. Currently you need " +
        "to reload the page (hit F5) to see them in the users list." }); // [5FKE0WY2] also in e2e
    });
  },

  render: function () {
    let content;
    if (this.state.isLoading)
      return r.p({}, "Loading...");

    if (!this.state.isOpen) {
      // Nothing.
    }
    else {
      const store: Store = this.state.store;
      const page: Page = store.currentPage;
      content =
        r.div({ id: 'e2eAddUsD'},
          rb.ReactSelect({ multi: true, value: this.state.selectedLabelValues,
            placeholder: "Select users",
            options: makeLabelValues(this.state.allUsers, page.pageMemberIds),
            onChange: this.onSelectChange }));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, "Select users")),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.save, id: 'e2eAddUsD_SubmitB',
              disabled: !this.state.selectedLabelValues.length }, "Add users"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


function makeLabelValues(users: BriefUser[], pageMemberIds: UserId[]) {
  return users.map((user: BriefUser) => {
    var prettyName = user.username;
    if (user.fullName) {
      prettyName += ' (' + user.fullName + ')';
    }
    var alreadyMember =  _.includes(pageMemberIds, user.id);
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
