
namespace rb {
  export var ReactBootstrap: any = window['ReactBootstrap'];
  export var Modal = reactCreateFactory(ReactBootstrap.Modal);
  export var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
  export var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
  export var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
  export var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);

  // How to use, async:
  // https://github.com/JedWatson/react-select/blob/677dd4fe7b219954c934176756c4d6239751e9f7/examples/src/components/Contributors.js#L39
  // Docs and demo, v1:
  //   https://v1.react-select.com/
  //   https://github.com/JedWatson/react-select/tree/v1.x
  export var ReactSelect = reactCreateFactory(window['Select']);
  export var ReactSelectAsync = reactCreateFactory(window['Select'].Async);

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
      listItemClassName: string) {
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
            // Don't use <Link> — the <GroupList> is shown in the about-user-dialog,
            // but it's outside any <Router> root, so there'd be an error:
            //   """Invariant failed: You should not use <Link> outside a <Router>""".
            // This one, though, works outside ReactRouter roots:
            LinkUnstyled({ to: urlPath }, name)));
  });
}


// (Or move to slim-bundle? So the search results page can be generated server side.)
//
export const Expandable = (
      props: { header: any, onHeaderClick: any, isOpen?: boolean,
        className?: string, openButtonId?: string },
      ...children): RElm => {

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



// Wouldn't it be better with a [pick_persona_click_handler]?
export function DeletePageBtn(ps: { pageIds: PageId[], store: Store, undel?: true,
        verb?: Verbosity, close: () => V }): RElm {

  const page = ps.verb > Verbosity.Full ? " page" : '';
  const title = (ps.undel ? "Undelete" : "Delete") + page;  // I18N

  return Button({ className: ps.undel ? 'e_UndelPgB' : 'e_DelPgB',
        onClick: (event: MouseEvent) => {
          const atRect = cloneEventTargetRect(event);
          persona.chooseEditorPersona({ store: ps.store, atRect,
                  isInstantAction: true }, (doAsOpts: DoAsAndOpts) => {
            const delOrUndel = ps.undel ? ReactActions.undeletePages : ReactActions.deletePages;
            delOrUndel({
                  pageIds: ps.pageIds, doAsAnon: doAsOpts.doAsAnon }, ps.close);
          });
        } },
      title);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

