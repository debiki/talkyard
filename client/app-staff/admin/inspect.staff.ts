/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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


//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

type CatsById = { [_: CatId]: Cat };
type SubCatsById = { [_: CatId]: Cat[] };
type GroupsById = { [groupId: PatId]: GroupVb };

// Some privacy preferences haven't been implemented — let's hide in prod mode,
// and wrap in '(..)' in dev mode.
let hideUnimpl = true;
// @ifdef DEBUG
hideUnimpl = false;
// @endif


export const InspectPanel = React.createFactory<AdminPanelProps>(
      function(_: AdminPanelProps) {

  const store: Store = useStoreState()[0];
  const me: Myself = store.me;
  const myId = React.useRef(me.id);
  const [inspectForumResp, setResp] = React.useState<InspectForumResp>(null);

  const groups: GroupVb[] = inspectForumResp?.groupsMaySee || [];
  const cats: Cat[] = inspectForumResp?.catsMaySee || [];
  const allPerms: PermsOnPage[] = inspectForumResp?.allPerms || [];


  // Dupl code. [dupl_load_groups]  Later, use [React19_actions]?
  React.useEffect(() => {
    myId.current = me.id;
    Server.inspectForum((resp: InspectForumResp) => {
      if (myId.current !== me.id) return;
      setResp(resp);
    });
    return () => myId.current = null;
  }, [me.id]);

  const baseCats: Cat[] = [];
  const catsById: CatsById = {};
  const catsByParentId: SubCatsById = {};
  const groupsById: GroupsById = arr_groupByKeepOne(groups, g => g.id);

  // Create lookup maps.
  for (let cat of cats) {
    catsById[cat.id] = cat;
    if (cat.parentId) {
      const siblings = catsByParentId[cat.parentId] || [];
      siblings.push(cat);
      catsByParentId[cat.parentId] = siblings;
    }
  }

  // If parent missing, it's a base cat (the server doesn't incl any root cats).
  for (let cat of cats) {
    const parent: Cat | U = catsById[cat.parentId];
    if (!parent) {
      baseCats.push(cat);
    }
  }

  return r.div({ className: 's_A_Insp' },
      rb.Alert({ bsStyle: 'info' },
        r.p({},
          r.b({}, "Might be some bug here. "), "This page is pretty new (2024-12).")),

      r.p({},
          "Here you can get an overview of how you've configured this community. " +
          "(Tell us if there's more things you'd like to see: ",
          r.span({}, "https://forum.talkyard.io"), ")"),

      !inspectForumResp ? r.p({ className: 'container' }, t.Loading) : rFr({},
          PrivPrefsTable({ groups }),
          AnonymityTable({ baseCats, catsByParentId }),
          PermsTable({ baseCats, catsByParentId, perms: allPerms, groupsById }),
          ),

      hideUnimpl ? null : r.div({ className: 'n_Dbg' },
          r.hr(),
          r.h2({}, "Groups"),
          r.pre({}, JSON.stringify(groups, undefined, 3)),
          r.h2({}, "Cats"),
          r.pre({}, JSON.stringify(cats, undefined, 3))),
      );
});



// Privacy
//------------------------------------------------------------------------------


const PrivPrefsTable = React.createFactory<{ groups: GroupVb[] }>(function(props) {
  // _Skip_custom_groups. Currently priv prefs can't be configured in custom groups
  // — hasn't been decided what priority they're going to have, compared to
  // the built-in trust level groups. [group_priorities]
  const trustLevelGroups: GroupVb[] = _.filter(props.groups, g => member_isBuiltIn(g));

  const headers =
          trustLevelGroups.map((group: GroupVb) => {
            return (
                r.th({ className: 'c_InspT_GrpName' },
                  r.div({}, r.span({}, GroupPrioNameLink(group, linkToPatsPrivPrefs)))));
          });

  const body = r.tbody({},
          hideUnimpl ? null : PrivPrefsRow("See my bio",
              (p: PrivacyPrefs) => p.maySeeMyBriefBioTrLv, trustLevelGroups),
          hideUnimpl ? null : PrivPrefsRow("See my group memberships",
              (p: PrivacyPrefs) => p.maySeeMyMembershipsTrLv, trustLevelGroups),
          PrivPrefsRow("See my profile",
              (p: PrivacyPrefs) => p.maySeeMyProfileTrLv, trustLevelGroups),
          hideUnimpl ? null : PrivPrefsRow("Find me by name",
              (p: PrivacyPrefs) => p.mayFindMeTrLv, trustLevelGroups),
          hideUnimpl ? null : PrivPrefsRow("See if I'm online",
              (p: PrivacyPrefs) => p.maySeeMyPresenceTrLv, trustLevelGroups),
          hideUnimpl ? null : PrivPrefsRow("See my statistics",
              (p: PrivacyPrefs) => p.maySeeMyApproxStatsTrLv, trustLevelGroups),
          PrivPrefsRow("List my recent posts",
              (p: PrivacyPrefs) => p.maySeeMyActivityTrLv, trustLevelGroups),
          // These have been implemented, but are currently not inherited properly from
          // ancestor groups, so, hide in prod mode for now. [inherit_priv_prefs_0impl]
          hideUnimpl ? null : PrivPrefsRow("Send me DMs",
              (p: PrivacyPrefs) => p.maySendMeDmsTrLv, trustLevelGroups),
          hideUnimpl ? null : PrivPrefsRow("Mention me",
              (p: PrivacyPrefs) => p.mayMentionMeTrLv, trustLevelGroups),
          );

  return rFr({},
      r.h2({}, "Privacy preferences"),  // [inherit_group_priv_prefs]

      r.p({},
          "Here you can see how you've configured privacy preferences, " +
          "and how they're inherited from groups to groups (and to members of those groups)."),

      r.p({},
          "Higher trust level group settings (that is, groups further to the right), " +
          "override lower trust level group settings (groups to the left). ",
          r.b({}, "For example, "), "if Mons is a moderator, and 'See profile' " +
          "is configured in the Moderators group, that 'See profile' setting is used, " +
          "when someone else than Mons tries to look at Mons' profile page. " +
          "— Any settings from groups to the left (lower precedence), " +
          "are overridden by the Moderators group."),

      r.p({},
          '"', r.b({}, "Me"), "\", \"", r.b({}, "My"), "\" and \"", r.b({}, "I"), '" below ' +
          "mean a member of the group in the column you're looking at. ",
          r.b({}, "For example,"), " if, in the All Members column, the " +
          "'See my profile' row is 3 = Full Members, " +
          "that means only Full Members and above can see the profile page of someone in " +
          "the All Members group."),

      r.p({},
          "The default is Everyone (zero, 0). For example, everyone who can access the forum " +
          "can see one's profile page, by default. (If the forum is private, " +
          "only those how have logged in can access it — " +
          "Everyone then is the same as All Members.)"),  // right now at least, [new_trust_levels]

      r.p({},
          r.span({ className: 'c_InhSamp' }, "Gray color "),
          "means the preference is inherited from the previous group."),

      r.table({ className: 'c_Insp_PrefsT' },
          r.thead({ className: 'c_Rotated' },
              r.th({}, ''), // first column is privacy preference names
              headers),
          body));
});


function PrivPrefsRow(title: St, getFn: (_: PrivacyPrefs) => TrustLevel | TrustLevelOrStaff,
            groups: GroupVb[]): RElm {
  let inheritedPref = null;
  return r.tr({},
      r.td({}, title),
      groups.map(group => {
        const thisGroupsPref = getFn(group.privPrefs);
        let className = '';
        let prefToShow: Nr | U;
        if (isVal(thisGroupsPref)) {
          prefToShow = thisGroupsPref;
          // In the next <td>, this'll be the inherited value.
          inheritedPref = thisGroupsPref;
          // Value was set (specified) on this group.
          className = 'n_Set';
        }
        else if (isVal(inheritedPref)) {
          prefToShow = inheritedPref;
          // Value inherited. This'll dim it.
          className = 'n_Inh';
        }
        else {
          // Preference not configured in this group, or any of its ancestors.
          // Leave curVal empty.  (Alternatively, could set to Everyone, or to All Members
          // if it's about doing sth (e.g. sending a DM), not just viewing [guests_0_mention].)
        }
        return r.td({ className }, prefToShow);
      }));
}



// Anonymity
//------------------------------------------------------------------------------


const AnonymityTable = React.createFactory<{ baseCats: Cat[], catsByParentId: SubCatsById }>(
        function(props) {

  const catsList = r.ul({ className: 'c_InspAno' },
      // Maybe would have been better with a table instead? [anonymity_table] But
      // if there're many sub categories, how do you collapse them, in a table? One
      // community has hundreds of sub categories.
      // But with sub cats as sub lists, you can use accordions widgets.
      r.li({}, r.div({ className: 'c_InspAno_Cat' },
          r.span({ className: 'c_InspAno_Cat_Name' }, ''),
          r.span({ className: 'c_InspAno_Cat_ComtAno' }, "Anonymous?"),
          r.span({ className: 'c_InspAno_Cat_AnoSt' }, "How long"))),
      props.baseCats.map((c: Cat) => {
        const childCats: Cat[] | U = props.catsByParentId[c.id];
        return r.li({ key: c.id },
            AnonymityRow(c),
            childCats && r.ul({}, childCats.map(cc => {
              return r.li({ key: cc.id },
                  AnonymityRow(cc, c));
            })));
      }));

  return rFr({},
      r.h2({}, "Anonymity"),
      r.p({ className: '' },
          "Here you can see which categories you've made anonymous."),

      r.p({ className: '' }, // _anon_intro
          "'", r.b({}, "–"),
          "' means the category is not anonymous. ", r.br(),

          "'", r.b({}, "Temp"),
          "' means the discussions are anonymous ", r.i({}, "temporarily"), " only. " +
          "This is useful for discussing ideas, for example.", r.br(),

          "'", r.b({}, "Perm"),
          "' means discussions are anonymous, permanently. " +
          "Useful for sensitive discussions."),

      r.p({},
          r.span({ className: 'c_InhSamp' }, "Gray color "), ", no, other color!, " +
          "means the setting is inherited from the parent category, or is the default."),

      catsList,
      );
});


function AnonymityRow(thisCat: Cat, parentCat?: Cat): RElm {
  // Inherited?
  const comtsStartInh = !thisCat.comtsStartAnon && parentCat?.comtsStartAnon;
  const comtsStartCat = comtsStartInh ? parentCat : thisCat;
  const comtsStartClass = comtsStartInh ? ' n_Inh' : (thisCat.comtsStartAnon ? ' n_Set' : '');

  const anonStatusInh = !isVal(thisCat.newAnonStatus) && isVal(parentCat?.newAnonStatus);
  const anonStatusCat = anonStatusInh ? parentCat : thisCat;
  const anonStatusClass = anonStatusInh ? ' n_Inh' :
                              (isVal(thisCat.newAnonStatus) ? ' n_Set' : '');

  return r.div({ className: 'c_InspAno_Cat' },
      r.span({ className: 'c_InspAno_Cat_Name' },
         LinkUnstyled({ to: linkToCat(thisCat) }, thisCat.name)),

      r.span({ className: 'c_InspAno_Cat_ComtAno' + comtsStartClass },
          !comtsStartCat.comtsStartAnon ? '–' :
              pagedialogs.neverAlways_title(comtsStartCat.comtsStartAnon)),

      r.span({ className: 'c_InspAno_Cat_AnoSt' + anonStatusClass },
          !anonStatusCat.newAnonStatus ? (
              // If not configured, Temp is the default, see: DiscPropDefaults [def_anon_status].
              comtsStartCat.comtsStartAnon ? "Temp" : '–') : (
                  // "Temp" and "Perm" are explained in the _anon_intro.
                  anonStatusCat.newAnonStatus === AnonStatus.IsAnonCanAutoDeanon ? "Temp" : (
                  anonStatusCat.newAnonStatus === AnonStatus.IsAnonOnlySelfCanDeanon ? "Perm" : (
                  anonStatusCat.newAnonStatus + ' TyEUNKANONST'))),
      ));
}



// Access permissions
//------------------------------------------------------------------------------


const PermsTable = React.createFactory<{ baseCats: Cat[], catsByParentId: SubCatsById,
        perms: PermsOnPage[], groupsById: GroupsById }>(function(props) {

  const catsList = r.ul({ className: 'c_InspPrm' },
      props.baseCats.map((baseCat: Cat) => {
        const permsBaseCat = props.perms.filter(p => p.onCategoryId === baseCat.id);
        // COULD_OPTIMIZE: Group perms by cat id.
        const subCats: Cat[] | U = props.catsByParentId[baseCat.id];
        return r.li({ key: baseCat.id },
            PermissionsOnCat(baseCat, permsBaseCat, props.groupsById),
            subCats && r.ul({}, subCats.map(subCat => {
              const permsSubCat = props.perms.filter(p => p.onCategoryId === subCat.id);
              return r.li({ key: subCat.id },
                  PermissionsOnCat(subCat, permsSubCat, props.groupsById));
            })));
      }));

  return rFr({},
      r.h2({}, "Access permissions"),
      r.p({},
          "Here you can see which user groups have access to which categories."),
      r.p({},
          "Permissions are additive: If any group you are in, " +
          "has a permission, you have it too."),
      // Have a look at the algorithm again, before commenting in this? [direct_cat_perms]
      // (And maybe permissions should be inherited? And Deny permissions too? [may_not_perms]
      // Probably too complicated.)
      //r.p({},
      //    "A sub category does *not* inherit permissions from its parent category — " +
      //    "you need to grant permissions explicitly, per category."),
      r.p({},
          // However, if ...
          "If someone cannot see a category, they also cannot see any of its " +
          "sub categories. Even if you try to grant may-see directly to a sub category."),
      catsList);
});


function PermissionsOnCat(thisCat: Cat, permsThisCat: PermsOnPage[], groupsById: GroupsById): RElm {
  const permsList = permsThisCat.map(perms =>
      r.li({ key: perms.forPeopleId },
        OneGroupsPerms(perms, groupsById)));

  return r.div({ className: 'c_InspPrm_Cat' },
      r.span({ className: 'c_InspPrm_Cat_Name' },
         LinkUnstyled({ to: linkToCat(thisCat) }, thisCat.name)),

      r.ul({ className: 'c_InspPrm_Cat_PrmLs' },
          permsList),
      );
}


function OneGroupsPerms(perms: PermsOnPage, groupsById: GroupsById): RElm {
  const groupId = perms.forPeopleId;
  const group = groupsById[groupId];
  const groupLink = group ? GroupPrioNameLink(group, linkToPatsProfile, false) :
          `Group missing, id ${groupId} [TyE0GRP4802]`;

  // The may-see permissions should be the most interesting ones. If missing,
  // the other perms have no effect.
  const seePermsList = [];
  const otherPermsList = [];

  _.each(perms, (val, key) => {
    // Don't show these; it's already clear from the table.
    if (key === 'id' || key === 'forPeopleId' || key === 'onCategoryId')
      return;

    const list = key.startsWith('maySee') ? seePermsList : otherPermsList;
    list.push(r.li({ key }, r.span({}, key), r.span({}, val)));
  });

  return rFr({},
      r.span({}, groupLink),
      r.ul({ className: 'c_InspPrm_Cat_PrmLs_GrpPrmLs' },
          seePermsList,
          otherPermsList));
}


// Utils
//------------------------------------------------------------------------------


function GroupPrioNameLink(group: GroupVb, linkFn: (_: Who) => St, showTrustLevel?: Bo): RElm {
  // This: `id - 10` just happens to work right now,  [new_trust_levels] [group_priorities]
  // except for the staff group (id 17, but not a trust level), mods (18) & admins (19),
  // then need to subtract 11 because of the Staff group in between, which isn't a trust level.
  // TrustLevelOrStaff.CoreMember = 6, Staff = 7, Admins = 8.
  const trustLevelNr = group.id < Groups.StaffId ? group.id - 10 : group.id - 11;

  showTrustLevel = showTrustLevel !== false &&
        // Only built-in groups have a trust level.
        member_isBuiltIn(group) &&
        // The staff group is not a trust level group, although it's built-in.
        // (Mods & admins are trust levels, though.)
        group.id !== Groups.StaffId;

  const groupName = pat_name(group);
  const title = showTrustLevel ? `${trustLevelNr}: ${groupName}` : groupName;

  return (
      LinkUnstyled({ to: linkFn(group.id) }, title));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
