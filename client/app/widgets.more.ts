/// <reference path="../typedefs/react/react.d.ts" />

namespace rb {
  export var ReactBootstrap: any = window['ReactBootstrap'];
  export var Modal = reactCreateFactory(ReactBootstrap.Modal);
  export var ModalHeader = reactCreateFactory(ReactBootstrap.ModalHeader);
  export var ModalTitle = reactCreateFactory(ReactBootstrap.ModalTitle);
  export var ModalBody = reactCreateFactory(ReactBootstrap.ModalBody);
  export var ModalFooter = reactCreateFactory(ReactBootstrap.ModalFooter);

  export var ReactSelect = reactCreateFactory(window['Select']);
  export var Nav = reactCreateFactory(ReactBootstrap.Nav);
  export var NavItem = reactCreateFactory(ReactBootstrap.NavItem);
  export var TabbedArea = reactCreateFactory(ReactBootstrap.TabbedArea);
  export var TabPane = reactCreateFactory(ReactBootstrap.TabPane);
  export var Alert = reactCreateFactory(ReactBootstrap.Alert);

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

var r = React.DOM;


// (Or move to slim-bundle? So the search results page can be generated server side.)
//
export var Expandable = (
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

