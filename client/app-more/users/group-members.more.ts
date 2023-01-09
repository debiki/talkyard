/**
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

interface GroupMembersProps {
  user: Group;
  store: Store;
}


export const GroupMembers = React.createFactory<GroupMembersProps>(function(props) {
  //displayName: 'GroupMembers',

  const group: Group = props.user; // werid name, could fix
  const store: Store = props.store;
  const me = store.me;
  const myId = React.useRef(me.id);
  const builtInOrNotStaff = member_isBuiltIn(group) || !isStaff(me);

  const [membersNullOrFalse, setMembers] = React.useState<Participant[] | null | false>(null);

  // Break out hook? [my_cur_id]
  React.useEffect(() => {
    myId.current = me.id;
    listAndSetMembers();
    return () => myId.current = null;
  }, [me.id]);

  function listAndSetMembers() {
    Server.listGroupMembers(group.id, (members) => {
      if (myId.current !== me.id) return;
      setMembers(members);
    });
  }

  if (membersNullOrFalse === null)
    return t.Loading;

  if (!membersNullOrFalse)
    return r.p({ className: 's_G_Mbrs-Dnd' }, t.gpp.MayNotListMembers);  // Dnd = denied

  const members: Participant[] = membersNullOrFalse;

  function showAddMembersDialog() {
    const currentMemberIds = members.map(m => m.id);
    pagedialogs.openAddPeopleDialog({ curPatIds: currentMemberIds,
          onChanges: (res: PatsToAddRemove) => {
      if (myId.current !== me.id) return;
      Server.addGroupMembers(group.id, res.addPatIds, listAndSetMembers);
    }});
  }

  function removeMember(memberId: UserId) {
    Server.removeGroupMembers(group.id, [memberId], listAndSetMembers);
  }

  const addMembersButton = builtInOrNotStaff ? null :
      Button({ className: 'e_AddMbrsB', onClick: () => showAddMembersDialog() },
        t.gpp.AddMembers);

  const memberElems = members.map((m: Participant) => {
     return r.li({ key: m.id, className: 's_G_Mbrs_Mbr' },
        LinkUnstyled({ to: UsersRoot + m.username, className: 's_G_Mbrs_Mbr_L' },
          UserName({ user: m, store, makeLink: false, onClick: null })),
        builtInOrNotStaff ? null :
          utils.ModalDropdownButton({ title: t.Manage + " ...", className: 'e_MngMbr' },
            Button({ className: 'e_RmMbr', onClick: () => removeMember(m.id) },
              t.Remove)));
  });

  const cannotModifyInfo = !member_isBuiltIn(group) ? null :
      r.p({}, t.gpp.BuiltInCannotModify);

  const orNoMembers = members.length ? null :
      r.p({ className: 's_G_NoMbrs'}, t.gpp.NoMembers);

  return rFragment({},
    cannotModifyInfo,
    r.h3({}, t.gpp.GroupMembers),
    addMembersButton,
    r.ul({ className: 's_G_Mbrs' }, memberElems),
    orNoMembers);
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
