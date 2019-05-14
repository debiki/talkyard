/*
 * Copyright (c) 2019 Kaj Magnus Lindberg
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
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;


export const ListGroupsComponent = React.createFactory<RouteChildProps>(function(props) {
  const store: Store = useStoreState()[0];
  const me: Myself = store.me;
  const notStaff = !isStaff(me);

  const [groupsOrNull, setGroups] = React.useState(null);

  React.useEffect(() => {
    Server.loadGroups(setGroups);
  },
    // Reload the groups, if we logout/in as a different user — then, which groups
    // we can seee, might change.
    [me.id]);

  if (!groupsOrNull)
    return (
        r.p({ className: 'container' },
          t.Loading));

  //const groupsSortedById: Group[] = [...groupsOrNull].sort((a, b) => a.id - b.id);
  const [builtInGroupsUnsorted, customGroupsUnsorted] =
      _.partition(groupsOrNull, member_isBuiltIn);

  // Place interesting groups like Admin, Moderators first.
  const builtInGroups = _.sortBy(builtInGroupsUnsorted, (g: Group) => -g.id);

  // Sort by name.
  const customGroups = _.sortBy(customGroupsUnsorted, (g: Group) => g.fullName || g.username);

  function makeGroupRows(groups: GroupAndStats[]) {
    return groups.map((g: GroupAndStats) => {
      const numMembers = !g.stats ? null :
        r.span({}, g.stats.numMembers + " members. ");  // I18N
      const youreAMember = !_.includes(me.myGroupIds, g.id) ? null :
        r.span({}, "You're a member."); // I18N

      return (
        r.li({ key: g.id, className: 's_Gs_G' },
          LinkUnstyled({ to: GroupsRoot + g.username, className: 's_Gs_G_L' },
            UserName({ user: g, store, makeLink: false, onClick: null })),
          r.p({ className: 's_Gs_G_Stats' },
            numMembers, youreAMember)));
    });
  }

  const callShowCreateDialog = () => {
    showCreateGroupDialog((newGroup: Group) => {
      location.assign(GroupsRoot + newGroup.username);
    });
  }

  const createGroupButton = !me.isAdmin ? null :
      Button({ className: 's_GP_CrGB', onClick: callShowCreateDialog }, "Create group");

  return (
      r.div({ className: 'container s_GP' },
        r.h3({}, "Custom groups:"),  // I18N
        createGroupButton,
        r.ul({ className: 's_Gs s_Gs-Custom' }, makeGroupRows(customGroups)),
        r.h3({}, "Built-in groups:"),  // I18N
        r.ul({ className: 's_Gs s_Gs-BuiltIn' }, makeGroupRows(builtInGroups))));

});



/*
const Modal = rb.Modal;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;

lazyDropdownMaker()(function() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
      Modal({ show: isOpen, onHide: () => setIsOpen(false), dialogClassName: '' },
        ModalHeader({}, ModalTitle({}, "Create Group")),
        ModalBody({}, contents),
        ModalFooter({}, saveCancel)));
});


/**
 * Creates a dropdow, but not until it's needed. There're 50? different dropdowns, and
 * creating them lazily on deman, instead of all-on-page-load, makes pages load
 * significatnly faster on mobile phones (like half a second? one second? — benchmarked
 * in Dev Tools and I forgot the results, except that this is totally worth opitmizing).
 * /
function lazyDialogMaker() {
  let dropdownDialog;
  return function(componentFactory) {
    if (!dropdownDialog) {
      dropdownDialog = ReactDOM.render(componentFactory, utils.makeMountNode());
    }
  }
}  */


let createGroupDialog;  // REFACTOR use lazyDialogMaker above instead of this

type NewGroupCallback = (_: Group) => void;
let pub_setOnCreatedCallback: (_: [NewGroupCallback]) => void;

function showCreateGroupDialog(onCreated: NewGroupCallback) {
  if (!createGroupDialog) {
    createGroupDialog = ReactDOM.render(CreateGroupDialog(), debiki2.utils.makeMountNode());
  }
  pub_setOnCreatedCallback([onCreated]);
}


const CreateGroupDialog = React.createFactory<{}>(function() {
  const [onCreatedCallback, setOnCreatedCallback] = React.useState<[NewGroupCallback]>(null);
  const [username, setUsername] = React.useState<ValueOk<string>>({});
  const [fullName, setFullName] = React.useState<ValueOk<string>>({});
  pub_setOnCreatedCallback = setOnCreatedCallback;

  const isOpen = !!onCreatedCallback;

  function serverCreateGroup() {
    const newGroupNoId: Group = {
      id: NoUserId,
      username: username.value,
      fullName: fullName.value,
      isGroup: true,
    };
    Server.createGroup(newGroupNoId, (newGroupWithId: Group) => {
      onCreatedCallback[0](newGroupWithId);
    });
  }

  let contents;
  let saveCancel;

  if (isOpen) {
    contents = rFragment({},
        util.UsernameInput({ label: t.cud.Username, id: 'te_CrGD_Un', tabIndex: 1,
          defaultValue: '', isForGroup: true,
          onChangeValueOk: (value, isOk) => setUsername({ value, isOk })
        }),
        util.FullNameInput({ label: t.cud.FullName, id: 'te_CrGD_FN', tabIndex: 1,
          defaultValue: '',
          onChangeValueOk: (value, isOk) => setFullName({ value, isOk }) }));

    const allFine = username.isOk && fullName.isOk;
    saveCancel = rFragment({},
      PrimaryButton({ onClick: () => serverCreateGroup(), disabled: !allFine }, "Create"),
      Button({ onClick: () => setOnCreatedCallback(null) }, "Cancel"));
  }

  return (
      Modal({ show: isOpen, onHide: () => setOnCreatedCallback(null), dialogClassName: 's_CrGD' },
        ModalHeader({}, ModalTitle({}, "Create Group")),
        ModalBody({}, contents),
        ModalFooter({}, saveCancel)));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------