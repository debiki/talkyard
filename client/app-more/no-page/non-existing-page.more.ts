/*
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   namespace debiki2.nopage {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


/**
 * When loading the homepage (url path '/') for a website, and if there's nothing
 * to show, we'll instead mount and render this NonExistingPage component.
 * Depending on the status and purpose of the site, the component might render
 * a signup-and-become-admin button, a login button, a link to moderate
 * embedded comments, or a button to create a forum, for example.
 */
export var NonExistingPage = createComponent({
  displayName: 'NonExistingPage',

  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  componentDidMount: function() {
    Server.maybeLoadGlobalAdminScript();
    Server.maybeLoadGlobalStaffScript();
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    var store: Store = this.state.store;
    var me: Myself = store.me;
    var siteStatus = store.siteStatus;
    var adminPendingMatch = siteStatus === SiteStatus.NoAdmin ||
        store.isFirstSiteAdminEmailMissing;
    if (adminPendingMatch && !me.isLoggedIn && !store.newUserAccountCreated) {
      return SignUpAsAdmin({ store: this.state.store });
    }
    else if (me.isAdmin) {
      /*
      if (siteStatus === 'IsEmbeddedSite') {  -- embedded comments disabled [5EU0232]
        return EmbeddedCommentsLinks(this.state.store);
      }
      else {
      */
      return CreateSomethingHere({ store: this.state.store });
    }
    else {
      return LoginToCreateSomething({ store: this.state.store });
    }
  }
});



const SignUpAsAdmin = createComponent({
  displayName: 'SignUpAsAdmin',

  render: function() {
    const store: Store = this.props.store;
    const embCmts = store.makeEmbeddedCommentsSite;
    let startOfTheEmailAddress;
    if (this.props.obfuscatedAminEmail) {
      startOfTheEmailAddress =
        r.span({}, 'That is, ', r.samp({}, this.props.obfuscatedAminEmail + '...@...'));
    }

    const anyEmailProblem = this.props.isFirstSiteAdminEmailMissing
      ? r.p({ style: { color: 'hsl(0, 100%, 45%)', fontWeight: 'bold' }},
          "But you haven't specified any ", r.code({}, 'debiki.becomeOwnerEmailAddress'),
          " value in the config file — please edit it and do so.", r.br(),
          "Then restart the app server: ", r.code({}, "docker-compose restart app"))
      : null;

    const loginBtn =
        PrimaryButton({ id: 't_OwnerSignupB', disabled: !!anyEmailProblem,
            onClick: () => login.getLoginDialog().openToSignUp(LoginReason.BecomeAdmin) },
          "Continue");

    return eds.siteId === debiki.FirstSiteId
      ? r.div({},
          r.h1({}, "Welcome"),
          r.p({}, "You have successfully started the server."),
          r.p({}, "Next, sign up using the email address you specified in the " +
            "configuration file in the ", r.code({}, 'becomeOwnerEmailAddress'), " field."),
          anyEmailProblem,
          r.br(),
          loginBtn)
      : r.div({},
          r.h1({}, "Welcome"),
          r.p({}, embCmts ? "Here you'll moderate comments." : "This is your new website."),
          r.p({}, "Look at the address bar above" + (
                embCmts ? ': ' : // will be like: 'comments-for-your-site.example.com' [7PLBKA24]
                  " — it starts with the address you specified: "), r.code({}, location.hostname)),
          r.br(),
          loginBtn);
  }
});



const LoginToCreateSomething = createComponent({
  displayName: 'LoginToCreateSomething',

  getInitialState: function() {
    return {};
  },

  sendEmailAgain: function() {
    Server.resendOwnerEmailAddrVerifEmail(() => {
      util.openDefaultStupidDialog({
        body: "Email sent (unless your email address has been verified already)" });
      this.setState({ emailSentAgain: true });
    })
  },

  render: function() {
    const store: Store = this.props.store;
    const embCmts = store.makeEmbeddedCommentsSite;

    let sendEmailAgainButton = this.state.emailSentAgain ? null :
      Button({ onClick: this.sendEmailAgain, className: 's_NP_EmailAgainB' },
        "Send email again");

    const pleaseLoginText =
        "Please login as admin to " + (embCmts ? "continue." : "create something here.");

    return (
      r.div({},
        r.h1({}, "Welcome"),
        r.p({}, pleaseLoginText),
        r.p({}, "If you haven't done this already: Please click the link in the " +
            "email address verification email I have sent you."),
        r.br(),
        reactelements.NameLoginBtns({ title: "Login", purpose: 'LoginAsAdmin' }),
        sendEmailAgainButton));
  }
});



export var EmbeddedCommentsLinks = createComponent({
  displayName: 'EmbeddedCommentsLinks',

  render: function() {
    return (
      r.div({},
        r.h1({}, "Welcome"),
        r.p({}, "If you have not yet configured your website to show embedded comments, " +
            "click ", r.b({}, "Setup Embedded Comments"), '.'),
        r.div({ className: 'do-what-options' },
          Button({ onClick: () => window.location.assign('/-/embedded-comments-help') },
              "Setup Embedded Comments"),
          Button({ onClick: () => window.location.assign('/-/admin/#/moderation') },
              "Moderate Comments"))));
  }
});



const CreateSomethingHere = createComponent({
  displayName: 'CreateSomethingHere',

  getInitialState: function() {
    return {
      createWhat: PageRole.Forum, // later: undefined — if there'll be Blog and Wiki too? [8GYK34]
    };
  },

  componentDidMount: function() {
    const store: Store = this.props.store;
    const embCmts = store.makeEmbeddedCommentsSite;
    if (embCmts) {
      Server.createEmbCmtsSiteGoToInstrs();  // (4WDKP07)
    }
  },

  render: function() {
    const store: Store = this.props.store;
    const embCmts = store.makeEmbeddedCommentsSite;
    const createWhat: PageRole = this.state.createWhat;
    const anyCreateForumPanel = createWhat === PageRole.Forum ?
        CreateForumPanel(store) : null;

    /*
    const anyCreateEmbeddedCommentsPanel = createWhat === PageRole.EmbeddedComments ?
        CreateEmbeddedCommentsPanel(store) : null;

    // For all sites except for the first one, we have already asked the user
    // if s/he wanted to create an embedded comments site, and s/he didn't.
    var message;
    var anyCreateEmbeddedCommentsButton;
    if (false) { // if (debiki.siteId === debiki.FirstSiteId) { // embedded comments broken now
      anyCreateEmbeddedCommentsButton =
          Button({ active: createWhat === PageRole.EmbeddedComments,
              onClick: () => this.setState({ createWhat: 'EmbeddedComments' })},
              'Setup Embedded Comments');
      message = 'This site is empty right now. What do you want to do?';
    }
    else {
      message = "This site is empty right now. Do you want to create a forum?";
    }*/

    if (embCmts) {
      // We've told the server to create a forum & category for embedded comments  (4WDKP07)
      // — show "Wait..." until it's done; afterwards, Server.createEmbCmtsSiteGoToInstrs
      // auto-jumps to the next step.
      return (
        r.div({},
          r.h1({}, "Wait..."),
          r.p({}, "Creating embedded comments things ...")));
    }

    return (
      r.div({},
        r.h1({}, "Configure your community"),
        r.p({}, "You can change all this later; nothing is carved in stone."),
        /* Add this back later if there'll be Blog and Wiki options too [8GYK34]
        r.p({}, message),
        r.div({ className: 'do-what-options' },
          PrimaryButton({ active: createWhat === PageRole.Forum, id: 'e2eCreateForum',
              disabled: anyCreateForumPanel || anyCreateEmbeddedCommentsPanel,
              onClick: () => this.setState({ createWhat: PageRole.Forum })},
              'Create a Forum'),
          anyCreateEmbeddedCommentsButton),
          */
        anyCreateForumPanel));
        // anyCreateEmbeddedCommentsPanel));
  }
});



export var CreateForumPanel = createComponent({
  displayName: 'CreateForumPanel',

  getInitialState: function() {
    return {
      title: '',
      useCategories: true,
      createSupportCategory: false,  // [NODEFCATS]
      createIdeasCategory: false,    // [NODEFCATS]
      createSampleTopics: true,
      topicListStyle: TopicListLayout.ExcerptBelowTitle,
      nextChoice: 1,
    };
  },

  handleChange: function() {
    this.setState({
      title: this.refs.forumName.getValue()
    });
  },

  createForum: function() {
    Server.createForum(<any> { folder: '/', ...this.state }, (forumUrlPath: string) => {
      window.location.assign(forumUrlPath);
    });
  },

  render: function() {

    let nextChoice = this.state.nextChoice;

    // Most defaults are ok; one can simply click Next, Next, Next.
    let thisChoiceDone = true;

    // Why these choices? Actually people like things they've invested a bit on-topic time
    // and decisions in. I think these choices make people feel the forum
    // is *theirs*, something *they* have created. And then they like it more. People don't
    // think ready made food they buy, is tasty. But if they have to do a tiny simple bit of
    // work, to prepare the food (like, mixing two ingredients) — then they think the food
    // tastes really nice. Just because they feel they made it.
    // So let them work a tiny bit here, to get started. Also, this helps them start out
    // with a forum that looks & works better for their use case.

    let forumNameChoice;
    let useCategoriesChoice;
    let createSupportCategoryChoice;
    let createIdeasCategoryChoice;
    let topicListStyleChoiceAndCreateButton;

    let nextButton;

    forumNameChoice = Input({ type: 'text', label: "Community name:",
        placeholder: "Type a name here",
        ref: 'forumName', onChange: this.handleChange });

    if (nextChoice === 1 && !this.state.title.trim()) {
      thisChoiceDone = false;
    }

    /*  [NODEFCATS]
    if (nextChoice >= 2) {
      useCategoriesChoice = Input({ type: 'checkbox',
          label: "Use categories? Probably a good idea, unless the community will be small. " +
              "(Default: Yes)",
          checked: this.state.useCategories,
          onChange: (event) => this.setState({ useCategories: event.target.checked }) });
    }

    if (this.state.useCategories) {
      if (nextChoice >= 3) {
        createSupportCategoryChoice = Input({ type: 'checkbox',
            label: "Create a Support category? Where people can ask questions.",
            checked: this.state.createSupportCategory,
            onChange: (event) => this.setState({ createSupportCategory: event.target.checked }) });
      }

      if (nextChoice >= 4) {
        createIdeasCategoryChoice = Input({ type: 'checkbox',
            label: "Create an Ideas category? Where people can suggest ideas.",
            checked: this.state.createIdeasCategory,
            onChange: (event) => this.setState({ createIdeasCategory: event.target.checked }) });
      }
    }
    else {
      nextChoice = 5;
    } */

    if (nextChoice >= 5) {
      const style = this.state.topicListStyle;
      let topicListPreviewImgSrc;

      let imgWidth;
      // Image widths: (so they'll show the same "zoom" level)
      // topic-list-titles-only.jpg: 978                      * 0.6295 = 621
      // topic-list-title-excerpt-same-line.jpg: 1055 pixels  * 0.6295 = 664
      // topic-list-excerpt-below-title.jpg: 1112 pixels      * 0.6295 = 700
      // topic-list-excerpts-and-thumbnails.jpg: 1112 pixels  * 0.6295 = 700
      // topic-list-news-feed.jpg: 810 pixels                 * 0.6295 = 510

      const prefix = `${eds.cdnOriginOrEmpty}/-/media/create-site/`;  // [NGXMEDIA]
      switch (style) {
        case TopicListLayout.TitleOnly:
          topicListPreviewImgSrc = prefix + 'topic-list-titles-only.jpg';
          imgWidth = 621;
          break;
        case TopicListLayout.TitleExcerptSameLine:
          topicListPreviewImgSrc = prefix + 'topic-list-title-excerpt-same-line.jpg';
          imgWidth = 664;
          break;
        case TopicListLayout.ExcerptBelowTitle:
          topicListPreviewImgSrc = prefix + 'topic-list-excerpt-below-title.jpg';
          imgWidth = 700;
          break;
        //case TopicListLayout.ThumbnailLeft:
          // Not implemented.
        case TopicListLayout.ThumbnailsBelowTitle:
          topicListPreviewImgSrc = prefix + 'topic-list-excerpts-and-thumbnails.jpg';
          imgWidth = 700;
          break;
        case TopicListLayout.NewsFeed:
          topicListPreviewImgSrc = prefix + 'topic-list-news-feed.jpg';
          imgWidth = 510;
          break;
      }

      const setTopicsStyle =
          (newStyle) => { return () => this.setState({ topicListStyle: newStyle }) };

      topicListStyleChoiceAndCreateButton =
          r.div({ className: 'clearfix' },
            r.br(),
            r.div({ style: { float: 'left' }},
              r.p({}, r.b({}, "How shall the topic list look?")),
              Input({ type: 'radio', label: "Titles only",
                checked: style === TopicListLayout.TitleOnly,
                onChange: setTopicsStyle(TopicListLayout.TitleOnly) }),
              Input({ type: 'radio', label: "Titles and excerpt, same line",
                checked: style === TopicListLayout.TitleExcerptSameLine,
                onChange: setTopicsStyle(TopicListLayout.TitleExcerptSameLine) }),
              Input({ type: 'radio', label: "Excerpt in separate paragraph",
                checked: style === TopicListLayout.ExcerptBelowTitle,
                onChange: setTopicsStyle(TopicListLayout.ExcerptBelowTitle),
                help: rFragment({}, "Shows a preview of each topic.", r.br(),
                  "This is the default.") }),
              Input({ type: 'radio', label: "Excerpts and thumbnails",
                checked: style === TopicListLayout.ThumbnailsBelowTitle,
                onChange: setTopicsStyle(TopicListLayout.ThumbnailsBelowTitle),
                help: "Like above, plus small preview images." }),
              Input({ type: 'radio', label: "Like a news feed",
                checked: style === TopicListLayout.NewsFeed,
                onChange: setTopicsStyle(TopicListLayout.NewsFeed),
                help: "Like above, but full width (no table layout)." }),
              PrimaryButton({ className: 's_NP_CreateForumB',
                onClick: this.createForum, disabled: !this.state.title.trim(),
                id: 'e2eDoCreateForum' }, "Create Community")),
            r.div({ className: 's_NP_TopicsPreview' },
              r.p({}, r.i({}, "Topic list preview:")),
              r.img({ width: imgWidth, src: topicListPreviewImgSrc })));
    }

    if (nextChoice <= 4) {
      const last = nextChoice === 4 ? " (last)" : '';
      nextButton = PrimaryButton({
          onClick: () => this.setState({ nextChoice: nextChoice + 999 }), // was: + 1  [NODEFCATS]
          disabled: !thisChoiceDone, className: 'e_Next' }, "Next" + last);
    }

    return (
      r.div({},
        forumNameChoice,
        useCategoriesChoice,
        createSupportCategoryChoice,
        createIdeasCategoryChoice,
        topicListStyleChoiceAndCreateButton,
        nextButton));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
