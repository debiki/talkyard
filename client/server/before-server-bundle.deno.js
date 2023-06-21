
        |// React expects `window` or `global` to exist, and my React code sometimes
        |// load React components from `window['component-name']`.
        |var global = window = this;
        |
        |$DummyConsoleLogFunctions
        |
        |var eds = {
        |  secure: $secure
        |};
        |// CLEAN_UP remove debiki.v0 & .internal [4KSWPY]
        |var debiki = {
        |  v0: { util: {} },
        |  internal: {},
        |};
        |
        |var debiki2 = debiki2 || {};
        |var theStore; // Hack. Used here and there directly [4AGLH2], works fine ... and fragile?
        |
        |/**
        | * A React store for server side rendering. No event related functions; no events happen
        | * when rendering server side.
        | */
        |debiki2.ReactStore = {
        |  allData: function() {
        |    return theStore;
        |  },
        |  getUser: function() {
        |    return theStore.me;
        |  },
        |  getPageTitle: function() { // dupl code [5GYK2]
        |    var titlePost = theStore.currentPage.postsByNr[TitleNr];
        |    return titlePost ? titlePost.sanitizedHtml : "(no title)";
        |  }
        |};
        |
        |// React-Router calls setTimeout(), but it's not available in Nashorn.
        |function setTimeout(callback) {
        |  callback();
        |}
