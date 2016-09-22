
declare var React: any;
declare var ReactDOM: any;
declare var NavLink: any;
declare var createComponent: any;
declare var createClassAndFactory: any;


declare namespace debiki2 {

	namespace utils {
    var scrollIntoViewInPageColumn;
    var PageUnloadAlerter;
    var makeMountNode;
  }

  var util: any;

  // should be moved to inside the editor bundle
  namespace editor {
    var markdownToSafeHtml: any;
  }

  var Server: any;
  var StoreListenerMixin: any;
  var ReactStore: any;
  var findDOMNode: any;
  var die: any;
  var dieIf: any;
  var pagedialogs: any;
  var scrollToBottom: any;
  var prettyBytes: any;
  var Server: any;
  var reactelements: any;
  var hashStringToNumber: any;
  var getFromLocalStorage: any;
  var putInLocalStorage: any;
  var event_isCtrlEnter: any;
  var help: any;
  var page_isPrivateGroup: any;
  var isBlank: any;
  var edithistory: any;
  var page_isPrivateGroup: any;
  var SelectCategoryDropdown: any;
  var PageRoleDropdown: any;

  // From widgets.ts:
  var PrimaryButton;
  var Button;
  var MenuItem;
  var MenuItemLink;
  var MenuItemDivider;
}
