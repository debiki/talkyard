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
  const myId = React.useRef(me.id);
  const [groupsOrNull, setGroups] = React.useState<Group[]>(null);

  React.useEffect(() => {
    myId.current = me.id;
    Server.loadGroups((groups) => {
      if (myId.current !== me.id) return;
      setGroups(groups);
    });
    return () => myId.current = null;
  }, [me.id]);

  if (!groupsOrNull)
    return (
        r.p({ className: 'container' },
          t.Loading));

  const [builtInGroupsUnsorted, customGroupsUnsorted] = <[Group[], Group[]]>
      _.partition(groupsOrNull, member_isBuiltIn);

  // Place interesting groups like Admins and Moderators first.
  const builtInGroups = _.sortBy(builtInGroupsUnsorted, g => -g.id);

  // Sort custom groups by name.
  const customGroups = _.sortBy(customGroupsUnsorted, g => g.fullName || g.username);

  function makeGroupRows(groups: GroupAndStats[]) {
    return groups.map((gs: GroupAndStats) => {
      const numMembers = !gs.stats ? null :
        r.span({}, t.gpp.NumMembers(gs.stats.numMembers) + '. ');
      const youreAMember = !_.includes(me.myGroupIds, gs.id) ? null :
        r.span({}, t.gpp.YouAreMember);

      return (
        r.li({ key: gs.id, className: 's_Gs_G' },
          LinkUnstyled({ to: GroupsRoot + gs.username, className: 's_Gs_G_Lk' },
            UserName({ user: gs, store, makeLink: false, onClick: null })),
          r.p({ className: 's_Gs_G_Stats' },
            numMembers, youreAMember)));
    });
  }

  const callShowCreateDialog = () => {
    showCreateGroupDialog((newGroup: Group) => {
      location.assign(GroupsRoot + newGroup.username);
    });
  }

  const createGroupButton = !me.isAdmin ? null : rFragment({},
      // This text is maybe not so easy to understand — UX_TESTING_MISSING — but better
      // than nothing I hope?
      r.p({ className: 's_GP_Expl' },
        "You can create custom groups. Examples: A group for your employees, " +
        "another for your customers. Or different groups for your teachers and students? " +
        "Volunteers, board members, donors?"),
      r.p({ className: 's_GP_Expl' },
        "Then, configure access permissions and notification settings, for everyone " +
        "in a group, by configuring category permissions for the group " +
        "(in the Edit Category dialogs). And by editing notification settings, in " +
        "the group's profile pages (click a group name below, then click " +
        "Preferences, then Notifications)."),
      Button({ className: 's_GP_CrGB', onClick: callShowCreateDialog }, "Create group"));

  return (
      r.div({ className: 'container s_GP' },
        r.h3({}, t.gpp.CustomGroupsC),
        createGroupButton,
        r.ul({ className: 's_Gs s_Gs-Custom' }, makeGroupRows(customGroups)),
        r.h3({}, t.gpp.BuiltInGroupsC),
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