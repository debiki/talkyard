/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../help/help-dialog.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagetools {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;


let pageToolsDialog;


export function getPageToolsDialog() {
  if (!pageToolsDialog) {
    pageToolsDialog = ReactDOM.render(PageToolsDialog(), utils.makeMountNode());
  }
  return pageToolsDialog;
}


const PageToolsDialog = createComponent({
  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData()
    };
  },

  open: function() {
    this.setState({ isOpen: true });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  //selectPosts: function() {
    // page.openSelectPostsDialog();
  //},

  unpinPage: function() {
    ReactActions.unpinPage(this.close);
  },

  deletePage: function() {
    const store: Store = this.state.store;
    ReactActions.deletePages([store.currentPageId], this.close);
  },

  undeletePage: function() {
    const store: Store = this.state.store;
    ReactActions.undeletePages([store.currentPageId], this.close);
  },

  render: function () {
    const store: Store = this.state.store;
    const page: Page = store.currentPage;
    const childProps = {
      store: store,
      closeAllDialogs: this.close
    };

    //let selectPostsButton = !store_canSelectPosts(store) ? null :
      //Button({ onClick: this.selectPosts }, "Select posts");

    let pinPageButton;
    let pinPageDialog;
    if (store_canPinPage(store)) {
      pinPageDialog = PinPageDialog(_.assign({ ref: 'pinPageDialog' }, childProps));
      pinPageButton =
          Button({ onClick: () => this.refs.pinPageDialog.open() },
            page.pinWhere ? "Edit Pin" : "Pin Topic");
    }

    const unpinPageButton = (!store_canPinPage(store) || !page.pinWhere) ? null :
      Button({ onClick: this.unpinPage, className: 'e_PinPg'  }, "Unpin Topic");

    const deletePageButton = !store_canDeletePage(store) ?  null :
      Button({ onClick: this.deletePage, className: 'e_DelPg' }, "Delete Topic");

    const undeletePageButton = !store_canUndeletePage(store) ?  null :
      Button({ onClick: this.undeletePage, className: 'e_RstrPg' }, "Restore Topic");

    const idsAndUrlsButton = page.pageRole !== PageRole.EmbeddedComments ?  null :
      Button({ onClick: () => openEmbeddingUrlAndIdsDialog(page), className: 'e_RstrPg' },
        "IDs and URLs ...");

    const buttons = r.div({},
      //selectPostsButton,
      pinPageButton,
      unpinPageButton,
      deletePageButton,
      undeletePageButton,
      idsAndUrlsButton,
      );

    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        pinPageDialog,
        ModalHeader({}, ModalTitle({}, "Do what?")),
        ModalBody({}, buttons),
        ModalFooter({}, Button({ onClick: this.close }, "Close"))));
  }
});


const DefaultPinOrder = 5;


const PinPageDialog = createComponent({
  getInitialState: function() {
    return { isOpen: false };
  },

  open: function() {
    const store: Store = this.props.store;
    const page: Page = store.currentPage;
    this.setState({
      isOpen: true,
      pinWhere: page.pinWhere || PinPageWhere.InCategory,
    });
  },

  close: function() {
    this.setState({ isOpen: false });
  },

  setPinWhere: function(pinWhere: PinPageWhere) {
    this.setState({ pinWhere });
  },

  doPin: function() {
    const pinOrder = parseInt(this.refs.pinOrderInput.getValue());
    if (isNaN(pinOrder) || pinOrder < 1 || pinOrder > 100) {
      alert("Please enter a number between 1 and 100");
      return;
    }
    ReactActions.pinPage(pinOrder, this.state.pinWhere, () => {
      this.close();
      this.props.closeAllDialogs();
      help.openHelpDialogUnlessHidden({
        content: r.span({ className: 'esPinnedOk' },
          "Pinned. Now there's a pin icon ", r.span({className: 'icon-pin'}),
          " in front of the topic title."),
        id: '32MYKP02',
      });
    });
  },

  render: function() {
    const pinGlobally = this.state.pinWhere === PinPageWhere.Globally;
    const store = this.props.store;
    return (
      Modal({ show: this.state.isOpen, onHide: this.close },
        ModalHeader({}, ModalTitle({}, "Pin Page")),
        ModalBody({},
          r.p({}, "Pin this topic to make it show up first in the forum topic list."),
          r.p({}, r.b({}, "Pin where?")),
          r.form({},
            Input({ type: 'radio', name: 'pinWhere', label: "In this category only",
                checked: !pinGlobally, onChange: () => this.setPinWhere(PinPageWhere.InCategory) }),
            Input({ type: 'radio', name: 'pinWhere', label: "The whole forum, all categories",
                checked: pinGlobally, onChange: () => this.setPinWhere(PinPageWhere.Globally) })),
          r.br(),
          Input({ type: 'number', label: "Pin order (you can ignore this)", ref: 'pinOrderInput',
              help: "Sort order if many topics are pinned, 1 is first.",
              defaultValue: store.pinOrder || DefaultPinOrder })),
        ModalFooter({},
          Button({ onClick: this.doPin }, store.pinWhere ? "Save" : "Pin"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});



let pageIdsUrlsDiagElm;
let setPageIdsUrlsDiagPageId;

export function openEmbeddingUrlAndIdsDialog(pageId: PageId) {
  if (!pageIdsUrlsDiagElm) {
    pageIdsUrlsDiagElm = ReactDOM.render(React.createFactory(PageIdsUrlsDiag)(), utils.makeMountNode());
  }
  setPageIdsUrlsDiagPageId(pageId);
}


export const PageIdsUrlsDiag = React.createFactory(function() {
  const [pageIdOrNull, setPageId] =  React.useState<Page>(null);
  setPageIdsUrlsDiagPageId = setPageId;

  const pageIdRef = React.useRef(pageIdOrNull);
  const [pageIdsUrls, setIdsUrls] = React.useState<PageIdsUrls>(null);
  const [origIdsUrls, setOrig] = React.useState<PageIdsUrls>(null);
  const [savingState, setSavingState] = React.useState('');

  React.useEffect(() => {
    pageIdRef.current = pageIdOrNull;
    if (pageIdOrNull) Server.loadPageEmbUrlsIds(pageIdOrNull, (response: PageIdsUrls[]) => {
      if (pageIdRef.current !== pageIdOrNull) return;
      setIdsUrls(response[0]);
      setOrig(response[0]);
    });
    return () => pageIdRef.current = null;
  }, [pageIdOrNull]);

  if (!pageIdOrNull || !pageIdsUrls)
    return null;

  const closeFn = () => setPageId(null);
  const saveFn = () => {
    setSavingState("Saving ...");
    Server.savePageEmbUrlsIds(pageIdsUrls, () => {
      setSavingState("Saved.");
      setOrig(pageIdsUrls);
    });
  };

  const makeUpdateFn = (what: keyof PageIdsUrls, splitOnNewline?: true) => {
    return (event) => {
      setSavingState("Save");
      const value = event.target.value
      const nextState = { ...pageIdsUrls };
      nextState[what] = splitOnNewline ? value.split(/\n/) : value;
      setIdsUrls(nextState);
    };
  }

  const nothingChanged = _.isEqual(pageIdsUrls, origIdsUrls);

  return (
      Modal({ show: true, onHide: closeFn, dialogClassName: 's_PageIdsD' },
        ModalHeader({}, ModalTitle({}, "Page IDs and URLs")),
        ModalBody({},
          r.p({}, "IDs and URLs associated with this page."),
          r.form({},
            r.p({},
              r.b({}, "Page ID: "), r.code({}, pageIdsUrls.pageId), r.br(),
              !eds.isInAdminArea ? null : // then we're on the page already
                rFragment({},
                  r.b({}, "Page URL path: "),
                  r.a({ href: pageIdsUrls.canonUrlPath, target: '_blank' },
                    r.code({}, pageIdsUrls.canonUrlPath)))),
              // Other url paths ... later [0WSKD46]
            Input({ label: "External ID",
                help: "Use this ID to refer to this page, in API requests.",
                value: pageIdsUrls.extId || '',
                onChange: makeUpdateFn('extId'),
                }),
            Input({ label: "Link-To URL",
                help: "Blog comments reply notification emails will link to this address.",
                value: pageIdsUrls.canonEmbUrl || '',
                onChange: makeUpdateFn('canonEmbUrl')
                }),
            Input({ type: 'textarea',  label: "Embedding URLs, one per line",
                help: "A blog post at any of these URLs, can embed this page.",
                value: pageIdsUrls.embeddingUrls.join('\n'),
                onChange: makeUpdateFn('embeddingUrls', true)
                }),
            Input({ type: 'textarea', label: "Discussion IDs, one per line",
                help: "A blog post with any of these discussion IDs, can embed this page.",
                value: pageIdsUrls.discussionIds.join('\n'),
                onChange: makeUpdateFn('discussionIds', true)
                }))),
        ModalFooter({},
          PrimaryButton({ onClick: saveFn, disabled: nothingChanged }, savingState || "Save"),
          Button({ onClick: closeFn }, nothingChanged ? "Close" : "Cancel"))));
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
