/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

// SMALLER_BUNDLE  could move to  staff bundle instead.

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

interface PatPermsProps {
  user: GroupVb;
  store: Store;
  updatePat: (_: PatVb) => Vo;
}


interface DiagState {
  permsNow: GroupPerms;
  savingStatus?: St;
  maxUplBytesErr?: St;
}


export const PatPerms = React.createFactory<PatPermsProps>(function(props) {
  //displayName: 'PatPerms',

  const groupBef: GroupVb = props.user; // weird name, could fix
  if (!groupBef.perms)
    return r.p({}, `May not access this group's permission settings. [TyE0SEEGRPPRMS]`);

  const store: Store = props.store;
  const me = store.me;
  const isModsOrCoreMembsGroup =
          groupBef.id === Groups.ModeratorsId ||
          groupBef.id === Groups.CoreMembersId;
  const isAdminsGroup =
          groupBef.id === Groups.AdminsId;

  const [state, setState] = React.useState<DiagState>({ permsNow: groupBef.perms });

  const permsNow = state.permsNow;

  // Break out hook? [my_cur_id]
  const myId = React.useRef(me.id);
  React.useEffect(() => {
    myId.current = me.id;
    // Clear changes if one logs out? Hmm maybe redirect to other profile tab?
    setState({ permsNow: groupBef.perms });
    return () => myId.current = null;
  }, [me.id]);

  function savePerms(event) {
    event.preventDefault();
    setState({ ...state, savingStatus: 'Saving ...' });
    Server.savePatPerms(groupBef.id, permsNow, (r: { patNoStatsNoGroupIds: PatVb }) => {
      if (myId.current !== me.id) return;
      setState({ ...state, savingStatus: 'Saved' });
      props.updatePat(r.patNoStatsNoGroupIds);
    });
  }

  const grantOrView = me.isAdmin ? "grant" : "view";
  const toOrOf = me.isAdmin ? "to" : "of";
  return r.div({ className: 's_PP_PrmsTb' },
      r.h3({}, "Group Permissions"),   // 0I18N, this is for staff only
      r.p({},
        `Here you can ${grantOrView} permissions ${toOrOf} members of this group. ` +
        "Permissions are additive: if any group you're in " +
        "lets you do something, then you can do it."),
      groupBef.id !== Groups.EveryoneId ? null : r.p({},
        r.b({}, "Note! "), "This group grants persmissions to everyone, " +
        "including strangers, e.g. anonymous blog commenters."
        ),
      groupBef.id !== Groups.AllMembersId || !me.isAdmin ? null : r.p({},
        r.b({}, "Note! "),
        "Permissions you grant here, are granted to all members. " +
        "(But not guests / anonymous blog commenters."
        ),

      r.form({ role: 'form', onSubmit: savePerms },
        !isModsOrCoreMembsGroup && !isAdminsGroup ? null :
        Input({ type: 'checkbox', label: "Can see everyone's email addresses",
            // wrapperClassName: 'col-xs-offset-2 col-xs-10',
            className: 's_PP_PrmsTb_SeeEmls  e_SeeEmls',
            // COULD show ticked but disabled, if inherited from ancestor group?
            // And, a link to that group, so can jump there to edit?
            checked: isAdminsGroup || permsNow.canSeeOthersEmailAdrs,
            disabled: !me.isAdmin || !isModsOrCoreMembsGroup,
            onChange: (event: CheckboxEvent) => {
              const canSeeOthersEmailAdrs = event.target.checked;
              setState({ permsNow: { ...permsNow, canSeeOthersEmailAdrs }, savingStatus: '' });
            },
            help:
                isAdminsGroup ? `Admins can always see others' email addresses.` : (
                // RM next line (only)?
                !isModsOrCoreMembsGroup ? `Can only be set for moderators and core members.` : (
                `Lets ${groupBef.id === Groups.CoreMembersId ? `core members and ` : ''
                        } moderators see everyone's email addresses.`))
                        // if mods, and core members ticked:
                        // + sth like:  "(Inherited from the Core Members group)"  ?
             }),

        Input({ label: "Max upload size, MiB:",
            className: 's_PP_PrmsTb_UplMiB',
            defaultValue: !_.isNumber(permsNow.maxUploadBytes) ? 0 :
                  (permsNow.maxUploadBytes * 1.0 / Sizes.Mebibyte).toFixed(2),
            disabled: !me.isAdmin,
            onChange: (event) => {
              const value = event.target.value;
              const maxUploadMiB = parseFloat(value);
              if (isNaN(maxUploadMiB) || !debiki2.isNumGeZ(value)) {
                setState({ ...state, maxUplBytesErr: `Bad number: ${value}`})
                return;
              }
              const maxUploadBytes = Math.floor(maxUploadMiB * Sizes.Mebibyte);
              setState({ permsNow: { ...permsNow, maxUploadBytes }, savingStatus: '' });
            } }),
        !state.maxUplBytesErr ? null :
          r.p({ style: { color: '#d00' } }, state.maxUplBytesErr),

        // Later, buttons like these that add common file extensions;
        //   "Images:       .jpg, .jpeg. .png .gif  [Allow]"
        //   "Documents:    .doc, .pdf, ...         [Allow]"
        //   "Video files:  .mp4, .mov, ..., .3g2   [Allow]"
        //   "Sound files:  ...                     [Allow]"
        //   "Archives:      zip tgz tar.gz gz      [Allow]"
        Input({ type: 'textarea', label: "Allowed file upload extensions:",
            className: 's_PP_PrmsTb_UplExts',
            help: rFr({}, "Space separated. Don't include dots, e.g. do this: ",
                r.kbd({}, 'jpg'), ", but not: ", r.kbd({}, '.jpg'),
                "."),
            value: permsNow.allowedUplExts || '',
            disabled: !me.isAdmin,
            onChange: (event) => {
              const allowedUplExts = event.target.value;
              setState({ permsNow: { ...permsNow, allowedUplExts }, savingStatus: ''});
            } }),

        InputTypeSubmit({ className: 'e_SvPerms', style: { marginTop: '11px' },
              value: "Save", disabled: !!state.maxUplBytesErr }),  // 0I18N
        r.span({}, ' ', state.savingStatus)));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
