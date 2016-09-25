

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
}

