/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
/// <reference path="../utils/PatternInput.more.ts" />
/// <reference path="../util/stupid-dialog.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.subcommunities {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const PatternInput = utils.PatternInput;


export function joinOrCreateSubCommunity(store: Store) {
  const me: Myself = store.me;
  if (me.isAdmin) {
    util.openDefaultStupidDialog({
      dialogClassName: '',
      // Skip i18n, is for admins only.
      body: "Join a community, or create a new community?",
      primaryButtonTitle: "Join existing",
      secondaryButonTitle: "Create new",
      onCloseOk: (number) => {
        if (!number) {
          // Cancel, do nothing.
        }
        else if (number === 1) {
          // Primary action, i.e. join.
          selectAndJoin();
        }
        else {
          dieIf(number !== 2, 'TyE26KGUW5');
          openCreateForumDialog();
        }
      },
    });
  }
  else {
    selectAndJoin();
  }
  function selectAndJoin() {
    selectSubCommunity(store, (forum: Forum) => {
      Server.joinPage(forum.pageId, () => {
        page.Hacks.navigateTo(forum.path);
      });
    });
  }
}


let createForumDialog;

export function openCreateForumDialog() {
  if (!createForumDialog) {
    createForumDialog = ReactDOM.render(CreateForumDialog(), utils.makeMountNode());
  }
  createForumDialog.open();
}


// Move to staff bundle?
const CreateForumDialog = createFactory({
  displayName: 'CreateForumDialog',

  getInitialState: function () {
    return { isOpen: false };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function() {
    this.setState({
      isOpen: true,
      // Skip i18n, is for admins only.
      newForumTitle: "New Community",
      newForumFolder: '',
    })
  },

  close: function() {
    this.setState({
      isOpen: false,
      newForumTitle: null,
      newForumFolder: null,
    });
  },

  doCreate: function() {
    const newForumPath = this.state.newForumFolder;
    Server.createForum({
      title: this.state.newForumTitle,
      folder: this.state.newForumFolder,
      useCategories: true,
      createSupportCategory: false,
      createIdeasCategory: false,
      createSampleTopics: false,
      topicListStyle: TopicListLayout.ExcerptBelowTitle,
    }, () => {
      page.Hacks.navigateTo(newForumPath);
    });
    this.close();
  },

  render: function () {
    let content;

    if (!this.state.isOpen) {
      // Nothing.
    }
    else {
      // Skip i18n, this is for admins only.
      content =
        r.div({ className: 'esTsD_CreateTs' },
          Input({ type: 'text', label: "Name:", id: 'e_NewCom_NameI',
            value: this.state.newForumTitle,
            onChange: (event) => this.setState({ newForumTitle: event.target.value }) }),
          PatternInput({ label: "URL path:", id: 'e_NewCom_FolderI',
            placeholder: '/something/',
            value: this.state.newForumFolder,
            onChangeValueOk: (value, ok) => this.setState({ newForumFolder: value, folderOk: ok }),
            help: "For example: /new-community/",
            notRegex: /\s/, notMessage: "No spaces please",
            notRegexTwo: /[^a-z0-9/-]/, notMessageTwo: "Only use characters a-z and 0-9 and /",
            regexThree: /^\//, messageThree: "Should start with a /",
            regexFour: /\/$/, messageFour: "Should end with a /",
            // UX COULD break out & use in title-editor.more.ts too?
          }),
          r.p({}, "The address to this community will be: ", r.br(),
            r.samp({}, location.origin + this.state.newForumFolder )));
    }

    return (
      // Skip i18n, this is for admins only.
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Create Community")),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.doCreate, disabled: !this.state.folderOk }, "Create"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


let selectSubCommunityDialog;

export function selectSubCommunity(store: Store, onDone: (Forum) => void) {
  if (!selectSubCommunityDialog) {
    selectSubCommunityDialog = ReactDOM.render(SelectSubCommunity(), utils.makeMountNode());
  }
  selectSubCommunityDialog.open(store, onDone);
}


const SelectSubCommunity = createFactory({
  displayName: 'SelectSubCommunity',

  getInitialState: function () {
    return { isOpen: false };
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(store: Store, onDone: (Forum) => void) {
    this.setState({ isOpen: true });
    Server.listForums((forums: Forum[]) => {
      if (this.isGone) return;
      this.setState({
        selectedOption: null,
        forums,
        store,
        onDone,
      });
    })
  },

  close: function() {
    this.setState({ isOpen: false, store: null, selectedOption: null, forums: null, onDone: null });
  },

  onSelectChange: function(newOption) {
    this.setState({ selectedOption: newOption });
  },

  doSelect: function() {
    const selectedForumId = this.state.selectedOption.value;
    const forum = _.find(this.state.forums, (f: Forum) => f.pageId === selectedForumId);
    this.state.onDone(forum);
    this.close();
  },

  render: function () {
    const store: Store = this.state.store;
    let content;

    if (!this.state.isOpen) {
      // Nothing.
    }
    else if (!this.state.forums) {
      content = r.p({}, t.Loading);
    }
    else {
      const watchbar = store.me.watchbar;
      const options = makeLabelValues(this.state.forums, watchbar);
      if (!options.length) {
        content = r.p({}, t.jscd.NoMoreToJoin);
      }
      else {
        content =
          r.div({ className: 'esTsD_CreateTs' },
            rb.ReactSelect({ value: this.state.selectedOption,
              className: 'esTsD_TsS', placeholder: t.jscd.SelCmty + ' ...',  // "Select community"
              options, onChange: this.onSelectChange }));
      }
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, t.jscd.SelCmty)), // "Select community"
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.doSelect, disabled: !this.state.selectedOption }, t.Join),
          Button({ onClick: this.close }, t.Cancel))));
  }
});


function makeLabelValues(forums: Forum[], watchbar: Watchbar) {
  const communitiesJoined = watchbar[WatchbarSection.SubCommunities];
  const forumsNotInWatchbar = _.filter(forums, (f: Forum) => {
    return !_.some(communitiesJoined, (c: WatchbarTopic) => c.pageId === f.pageId);
  });

  return forumsNotInWatchbar.map((forum: Forum) => {
    return { label: forum.title, value: forum.pageId };
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
