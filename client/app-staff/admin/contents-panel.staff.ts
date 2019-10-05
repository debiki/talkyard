
//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const ContentsPanel = React.createFactory<AdminPanelProps>(function(props: AdminPanelProps) {

  const [pageIdsUrls, setIdsUrls] = React.useState<PageIdsUrls[]>(null);

  React.useEffect(() => {
    Server.loadPageEmbUrlsIds(null, (response: PageIdsUrls[]) => {
      setIdsUrls(response);
    });
  }, []);

  if (!pageIdsUrls)
    return "Loading ...";

  const pageElms = pageIdsUrls.map((idsUrls: PageIdsUrls) => {
    const keyValue = (k, v) =>
        r.div({},
          r.b({}, k + ': '),
          isNullOrUndefined(v) ? '' : JSON.stringify(v));
    return r.li({ key: idsUrls.pageId },
      keyValue("Page ID", idsUrls.pageId),
      keyValue("Ext ID", idsUrls.extId),
      keyValue("Title", idsUrls.title),
      keyValue("URL path", idsUrls.canonUrlPath),
      //keyValue("Redirecting URL paths", idsUrls.redirdUrlPaths),  // later [0WSKD46]
      keyValue("Canonical embedding URL", idsUrls.canonEmbUrl),
      keyValue("Other embedding URLs", idsUrls.embeddingUrls),
      keyValue("Discussion IDs", idsUrls.discussionIds),
      Button({ onClick: () => {
          // This reloads the ids and urls for the page — that's good, so we'll get
          // up-to-date values and so reduce risk for The Lost Update Bug.
          debiki2.pagetools.openEmbeddingUrlAndIdsDialog(idsUrls.pageId)
        }},
        "Edit"),
      );
  });

  return (
      r.div({ className: '' },
        rb.Alert({ bsStyle: 'info' },
          r.p({},
            r.b({}, "Experimental!"), " You can ignore all this."),
          r.p({},
            "Here you can see pages (and, later, categories) and " +
            "their associated ids and urls. " +
            "For example, external ids, for API requests. " +
            "Or blog comments discussion ids and blog post urls. " +
            "— Currently lists at most 333 pages."),  // [333PAGES]
          r.p({},
            r.b({}, "RELOAD"), " this page, to see changes you make by clickind Edit. For now."),
          ),
        r.ul({},
          pageElms)));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list