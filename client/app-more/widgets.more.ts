
namespace rb {
  export var ReactBootstrap: any = window['ReactBootstrap'];
  export var Modal = reactCreateFactory(ReactBootstrap.Modal);
  export var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
  export var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
  export var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
  export var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);

  export var ReactSelect = reactCreateFactory(window['Select']);
  export var TabbedArea = reactCreateFactory(ReactBootstrap.TabbedArea);
  export var TabPane = reactCreateFactory(ReactBootstrap.TabPane);
  export var Tabs = reactCreateFactory(ReactBootstrap.Tabs);
  export var Tab = reactCreateFactory(ReactBootstrap.Tab);
  export var Alert = reactCreateFactory(ReactBootstrap.Alert);
  export var ProgressBar = reactCreateFactory(ReactBootstrap.ProgressBar);

  export var FormGroup = reactCreateFactory(ReactBootstrap.FormGroup);
  export var ControlLabel = reactCreateFactory(ReactBootstrap.ControlLabel);
  export var FormControl = reactCreateFactory(ReactBootstrap.FormControl);
  export var HelpBlock = reactCreateFactory(ReactBootstrap.HelpBlock);
  export var Checkbox = reactCreateFactory(ReactBootstrap.Checkbox);
  export var Radio = reactCreateFactory(ReactBootstrap.Radio);
  export var InputGroupAddon = reactCreateFactory(ReactBootstrap.InputGroup.Addon);

}


//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


const notBold = { style: {
  fontWeight: 'normal',
  marginLeft: '3px',
  opacity: 0.93,
}};

export const FullNameLabel = rFragment({},
  t.cud.FullNameC, r.span(notBold, ' (' + t.cud.optName + ')'));

export const emailLabel = (isForGuest: boolean) => rFragment({},
  t.cud.EmailC, r.span(notBold, ' (',
    isForGuest ? t.cud.forNotfsKeptPriv : t.cud.keptPriv,
    ')'));


export const GroupList = function(member: UserDetailsStatsGroups, groupsMaySee: Group[],
      listItemClassName: string, canUseLink?: false) {
  let maxTrustLevelGroup = Groups.AllMembersId;
  member.groupIdsMaySee.forEach(id => {
    // Staff users are included in all built-in groups. [COREINCLSTAFF]
    if (maxTrustLevelGroup < id && id <= Groups.MaxBuiltInGroupId) {
      maxTrustLevelGroup = id;
    }
  });

  const groupsOnlyOneBuiltIn =
    _.filter(member.groupIdsMaySee, (id) => id > Groups.MaxBuiltInGroupId);
  // Maybe lower id groups tend to be more interesting? Got created first.
  groupsOnlyOneBuiltIn.sort((a, b) => a - b);
  // Place the built-in group first — it shows the trust level, and if is staff.
  groupsOnlyOneBuiltIn.unshift(maxTrustLevelGroup);

  return groupsOnlyOneBuiltIn.map(groupId => {
    const group = _.find(groupsMaySee, g => g.id === groupId);  // [On2]
    if (!group)
      return null;
    const name = group.fullName || group.username;
    const urlPath = linkToUserProfilePage(group);
    return (
      r.li({ key: groupId, className: listItemClassName },
        // If we aren't inside a ReactRouter route, then, Link() won't work,
        // throws an error.
        canUseLink === false
            ? r.a({ href: urlPath, target: '_blank' }, name)
            : Link({ to: urlPath }, name)));
  });
}


// (Or move to slim-bundle? So the search results page can be generated server side.)
//
export const Expandable = (
      props: { header: any, onHeaderClick: any, isOpen?: boolean,
        className?: string, openButtonId?: string },
      ...children) => {

  let body = !props.isOpen ? null :
    r.div({ className: 's_Expandable_Body' }, children);

  let statusClass = props.isOpen ? '' : 's_Expandable-Closed ';
  let onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    props.onHeaderClick(event);
  };

  return (
    r.div({ className: 's_Expandable ' + statusClass + (props.className || '') },
      r.button({ className: 's_Expandable_Header', onClick: onClick,
          id: props.openButtonId },
        r.span({ className: 'caret' }), props.header),
      body))
};


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

