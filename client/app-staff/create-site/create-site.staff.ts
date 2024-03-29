/*
 * Copyright (c) 2015, 2017 Kaj Magnus Lindberg
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

/// <reference path="../staff-prelude.staff.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.createsite {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;

const PatternInput = utils.PatternInput;



export function routes() {
  return Switch({},
    RedirToNoSlash({ path: '/-/create-site/' }),
    RedirToNoSlash({ path: '/-/create-test-site/' }),
    Route({ path: '/-/create-site', strict: true, component: CreateSomethingComponent }),
    Route({ path: '/-/create-test-site', strict: true, component: CreateSomethingComponent }));
}



const CreateSomethingComponent = createReactClass({
  displayName: 'CreateSomethingComponent',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    Server.maybeLoadGlobalAdminScript();
    Server.maybeLoadGlobalStaffScript();
  },

  render: function() {
    // This was needed in the past. Can be simplified now, maybe this whole class can be elliminated.
    return (
      Route({ path: '*', render: (props) => {
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        return CreateWebsiteComponent({ ...props });
      }}));
  }
});


interface CreateSiteState {
  isForEmbeddedComments;
  makePublic: Bo;
  okayStatuses: { [name: St]: Bo };
  showAddress?: Bo;
  showOrgNameInp?: Bo;
  showPrivPubl?: Bo;
}

const CreateWebsiteComponent = createFactory<any, any>({
  displayName: 'CreateWebsiteComponent',

  getInitialState: function() {
    const isForEmbeddedComments = location.pathname.indexOf('embedded-comments') >= 0;
    return {
      isForEmbeddedComments,
      okayStatuses: {
        address: false,
        orgName: false,
      },
      // embeddingOrigin: '', // not in use?
      makePublic: true,
    } satisfies CreateSiteState;
  },

  componentDidUpdate: function(prevProps, prevState: CreateSiteState) {
    const state: CreateSiteState = this.state;
    if (state.showAddress && !prevState.showAddress) {
      (this.refs.embeddingOrigin || this.refs.localHostname).focus();
    }
    if (state.showOrgNameInp && !prevState.showOrgNameInp) {
      this.refs.organizationName.focus();
    }
  },

  handleSubmit: function(event) {
    const state: CreateSiteState = this.state;
    const testSitePrefix = // dupl code [5UKF03]
      location.pathname.indexOf('create-test-site') !== -1 ? 'test--' : '';
    const isComments = state.isForEmbeddedComments;
    const localHostname = isComments ? null : testSitePrefix + this.refs.localHostname.getValue();
    const embeddingOrigin = !isComments ? null : this.refs.embeddingOrigin.getValue();

    event.preventDefault();
    Server.createSite({
        localHostname,
        anyEmbeddingSiteAddress: embeddingOrigin,
        organizationName: this.refs.organizationName.getValue(),
        makePublic: state.makePublic,
        onOk: (nextUrl: St) => {
          window.location.assign(nextUrl);
        }});
  },

  reportOkay: function(what: St, isOk) {
    const state: CreateSiteState = this.state;
    const okayStatuses = { ...state.okayStatuses };
    okayStatuses[what] = isOk;
    this.setState({ okayStatuses });
  },

  render: function() {
    const state: CreateSiteState = this.state;
    const okayStatuses = state.okayStatuses;
    const disableSubmit = _.includes(_.values(okayStatuses), false);
    const isComments = state.isForEmbeddedComments;
    const embeddingOriginOrLocalHostname = isComments
      ? EmbeddingAddressInput({
          tabIndex: 10,
          onChangeValueOk: (value, isOk) => {
            this.setState({ embeddingOrigin: value });
            this.reportOkay('address', isOk)
          } })
      : LocalHostnameInput({ label: "Site Address:", placeholder: 'your-forum-name',
            tabIndex: 10,
            help: "The address of your new site. You can change this later,  " +
                "e.g. to a custom domain.",
            ref: 'localHostname',
            onChangeValueOk: (value, isOk) => this.reportOkay('address', isOk) });

    return (
      r.div({},
        r.h1({}, isComments ? "Create Embedded Comments" : "Create Forum"),
        r.form({ className: 'esCreateSite', onSubmit: this.handleSubmit },
          r.div({ className: 'n_InpSec' },
              embeddingOriginOrLocalHostname),

          NextStepButton({ onShowNextStep: () => this.setState({ showOrgNameInp: true }),
              showThisStep: okayStatuses.address && !state.showOrgNameInp,
              id: 'e2eNext3', tabIndex: 15 },
            "Next"),

          !state.showOrgNameInp ? null :
            PatternInput({ label: "Organization name:", placeholder: "Your Organization Name",
              tabIndex: 20, wrapperClassName: 'n_InpSec',
              help: "The name of your organization, if any.  Otherwise, you " +
                "can use your own name.  Will be used in your Terms of Use " +
                "and Privacy Policy documents. " +
                "— You can change the name later (in your site's admin settings).",
              ref: 'organizationName', id: 'e2eOrgName',
              regex: /\S/, message: "Name required",
              onChangeValueOk: (value, isOk) => this.reportOkay('orgName', isOk) }),

          isComments ? null :
          NextStepButton({ onShowNextStep: () => this.setState({ showPrivPubl: true }),
              showThisStep: okayStatuses.orgName && !state.showPrivPubl,
              id: 'e_Next4', tabIndex: 25 },
            "Next"),

          !state.showPrivPubl || isComments ? null :
            r.div({ className: 'n_InpSec' },
              r.p({}, r.b({}, "Public or private?")),
              r.p({},
                  "Shall people on the Internet see the discussions in the forum? ",
                  r.small({}, "(For example, an online community, or customer support.)")),
              r.p({},
                  "Or shall everything be private, not visible unless logged in? ",
                  r.small({}, "(For example, a company internal forum.)")),
              Input({ type: 'radio', name: 'pubPriv', id: 'e_MkPub', tabIndex: 30,
                  label: rFr({}, "Public   (except for private categories)"),
                  checked: state.makePublic,
                  onChange: () => this.setState({ makePublic: true }),
                  }),
              Input({ type: 'radio', name: 'pubPriv', id: 'e_MkPriv', 
                  // (tabIndex: 30 — doesn't matter. All radio buttons with the same 'name:'
                  // get the same index, and one navigates using the up-down arrow keys.)
                  label: "Everything private",
                  checked: !state.makePublic,
                  onChange: () => this.setState({ makePublic: false }),
                  })),

          !state.showPrivPubl && !(isComments && state.showOrgNameInp) ? null :
            InputTypeSubmit({ value: "Create Site", disabled: disableSubmit, tabIndex: 40 }))));
  }
});


function NextStepButton(props: { id: St, onShowNextStep: () => V, showThisStep?: Bo,
      tabIndex: Nr }, text: RElm | St) {
  // Listen to onFocus, so the next field will appear directly when one tabs
  // away from the previous field. onFocus apparently works with mouse & touch too.
  // However, onFocus apparently does *not* work in Safari, so listen to onClick too.
  return (
      PrimaryButton({ onClick: props.onShowNextStep, onFocus: props.onShowNextStep,
          style: { display: props.showThisStep ? 'block' : 'none' }, id: props.id,
          tabIndex: props.tabIndex },
        text));
}



export function EmbeddingAddressInput(props) {
  return (
    PatternInput({ label: props.label || "Embedding site:",
      tabIndex: props.tabIndex,
      id: 'e_EmbeddingUrl', className: '',
      style: props.style,
      placeholder: 'https://your.website.com',
      help: props.help || "The address of your blog / website where you're adding the comments.",
      ref: 'embeddingOrigin',
      trim: true,
      regex: /\S/, message: "Address required",
      regexTwo: /^https?:\/\/[^/]+/, messageTwo: "Should be http(s)://something...",
      notRegex: /\S\s\S/, notMessage: "No spaces please",
      notRegexTwo: /[@#\?]/, notMessageTwo: "No weird characters please (e.g. not @#?)",
      onChangeValueOk: props.onChangeValueOk }));
}



/**
 * Don't make the domain editable at this point, because then some people would edit it,
 * without realizing or remembering that they need to update their domain name server
 * records before this'll work. So instead: 1) let people create a default-domain site,
 * and later 2) let them connect it to their own main domain, from the admin pages.
 * Then they can return to the default-domain address, if they mess up, and fix things.
 */
const LocalHostnameInput = createClassAndFactory({
  displayName: 'LocalHostnameInput',

  getInitialState: function() {
    return { value: '' }
  },

  setValue: function(newValue) {
    this.setState({ value: newValue });
  },

  getValue: function() {
    return this.state.value;
  },

  focus: function() {
    this.refs.input.focus();
  },

  onChange: function(event) {
    const value = event.target.value.toLowerCase();
    const anyError = this.findAnyError(value);
    this.setState({ value });
    this.props.onChangeValueOk(value, !anyError);
  },

  showErrors: function() {
    this.setState({ showErrors: true });
  },

  findAnyError: function(value?: string) {
    if (_.isUndefined(value)) {
      value = this.state.value;
    }

    // Somebody didn't understand "No dots please", a recording shows / indicates.
    // Maybe non-native speakers sometimes don't know what a 'dot' is?
    // Hence, this explanation:
    const useDashInstead = () =>
      r.span({ className: 'n_Instead' },
              "Use dashes (-) instead: ",
              r.samp({}, value.replace(/[\. ]+/g, '-')));

    if (/\./.test(value))
      return rFr({}, "No dots please. ", useDashInstead());

    if (/\s/.test(value))
      return rFr({}, "No spaces please. ", useDashInstead());

    if (/^[0-9].*/.test(value))
      return "Don't start with a digit";

    if (!/^[a-z0-9-]*$/.test(value))
      return "Use only letters a-z and 0-9, e.g. 'my-new-website'";

    if (/.*-$/.test(value))
      return "Don't end with a dash (-)";

    if (value.length < 6 && !anyForbiddenPassword())
      return "Too short. Type at least six characters";

    if (value.length < 2)
      return 'Too short'; // a server side regex requires >= 2 chars

    return null;
  },

  render: function() {
    const value = this.state.value;
    let anyError: any;
    if (this.state.showErrors) {
      anyError = this.findAnyError();
      if (anyError) {
        anyError = r.span({ className: 'n_Err' }, anyError);
      }
    }
    // Check the router state, not location pathname, later after having upgr to react-router-
    // -some-version-for-which-the-docs-works.
    const testSitePrefix = // dupl code [5UKF03]
        location.pathname.indexOf('create-test-site') !== -1 ? 'test--' : '';
    // @ifdef DEBUG
    dieIf(!eds.baseDomain, 'No base domain [TyE5295RM]');
    // @endif
    return (
      r.div({ className: 'form-group' + (anyError ? ' has-error' : ''), style: this.props.style },
        r.label({ htmlFor: 'dwLocalHostname' }, this.props.label),
        r.br(),
        r.kbd({}, location.protocol + '//' + testSitePrefix),
        r.input({ type: 'text', id: 'dwLocalHostname', className: 'form-control',
            tabIndex: this.props.tabIndex,
            placeholder: this.props.placeholder, ref: 'input', onChange: this.onChange,
            value: value, onFocus: this.showErrors }),
        r.kbd({}, '.' + eds.baseDomain),
        r.p({ className: 'help-block' }, this.props.help),
        anyError));
  }
});


/**
 * Converts e.g. 'https://www.my-lovely.site.com' to 'my-lovely-site'.
 */
function deriveLocalHostname(embeddingSiteAddress) {
  var debikiAddress = embeddingSiteAddress;
  // Remove protocol.
  debikiAddress = debikiAddress.replace(/^[a-z]+:\/\//, '');
  // Remove port.
  debikiAddress = debikiAddress.replace(/:[0-9]+$/, '');
  // Remove top level domain.
  debikiAddress = debikiAddress.replace(/\.[a-z]*$/, '');
  // Remove any rather uninteresting leading 'www'.
  debikiAddress = debikiAddress.replace(/^www\./, '');
  // Replace '.' and other weird chars with '-'.
  debikiAddress = debikiAddress.replace(/[^a-z0-9]/g, '-');
  // Replace '----....' with a single '-'.
  debikiAddress = debikiAddress.replace(/-+/g, '-');
  return debikiAddress;
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
