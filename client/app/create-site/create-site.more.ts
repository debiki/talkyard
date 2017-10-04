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

/// <reference path="../slim-bundle.d.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../util/EmailInput.more.ts" />
/// <reference path="../utils/PatternInput.more.ts" />

//------------------------------------------------------------------------------
   module debiki2.createsite {
//------------------------------------------------------------------------------

var r = React.DOM;
var reactCreateFactory = React['createFactory'];

var EmailInput = util.EmailInput;
var PatternInput = utils.PatternInput;



export function routes() {
  return [
    Redirect({ key: 'redir', from: '/-/create-site/', to: '/-/create-site' }),
    Route({ key: 'routes', path: '/-/create-site', component: CreateSomethingComponent },
      /* Later, if one should choose between a site and embedded comments:
       IndexRoute({ handler: ChooseSiteTypeComponent }),
       Route({ path: 'website', handler: CreateWebsiteComponent }),
       */
      IndexRoute({ component: CreateWebsiteComponent }),
      Route({ path: 'embedded-comments', component: CreateWebsiteComponent })),
    Route({ key: 'test-routes', path: '/-/create-test-site', component: CreateSomethingComponent },
      IndexRoute({ component: CreateWebsiteComponent }),
      Route({ path: 'embedded-comments', component: CreateWebsiteComponent }))];
}



const CreateSomethingComponent = React.createClass({
  displayName: 'CreateSomethingComponent',

  getInitialState: function() {
    return {
      pricePlan: this.props.location.query.pricePlan
    };
  },

  render: function() {
    return (
      React.cloneElement(this.props.children, { pricePlan: this.state.pricePlan }));
  }
});



const CreateWebsiteComponent = React.createClass(<any> {
  displayName: 'CreateWebsiteComponent',

  getInitialState: function() {
    // Later: add Non-Commercial or Hobby / Business checkbox.
    let pricePlan = PricePlan.NonCommercial;
    if (location.pathname.indexOf('business') !== -1) pricePlan = PricePlan.Business;
    if (location.pathname.indexOf('embedded-comments') !== -1) pricePlan = PricePlan.EmbeddedComments;

    return {
      pricePlan,
      okayStatuses: {
        email: false,
        email2: false,
        address: false,
        orgName: false,
        terms: false,
      },
      email: '',
      email2: null,
      showEmail2: false,
      embeddingOrigin: '',
    };
  },

  componentDidUpdate: function(prevProps, prevState) {
    if (this.state.showEmail2 && !prevState.showEmail2) {
      this.refs.emailAddress2.focus();
    }
    if (this.state.showAddress && !prevState.showAddress) {
      (this.refs.embeddingOrigin || this.refs.localHostname).focus();
    }
    if (this.state.showRemaining && !prevState.showRemaining) {
      this.refs.organizationName.focus();
    }
  },

  handleSubmit: function(event) {
    const testSitePrefix = // dupl code [5UKF03]
      location.pathname.indexOf('create-test-site') !== -1 ? 'test--' : '';
    const isComments = this.state.pricePlan === PricePlan.EmbeddedComments;
    const localHostname = isComments ? null : testSitePrefix + this.refs.localHostname.getValue();
    const embeddingOrigin = !isComments ? null : this.refs.embeddingOrigin.getValue();

    event.preventDefault();
    Server.createSite(
        this.refs.emailAddress.getValue(),
        localHostname,
        embeddingOrigin,
        this.refs.organizationName.getValue(),
        this.state.pricePlan,
        (nextUrl) => {
          window.location.assign(nextUrl);
        });
  },

  reportOkay: function(what, isOk) {
    const okayStatuses = this.state.okayStatuses;
    okayStatuses[what] = isOk;
    this.setState({ okayStatuses: okayStatuses });
  },

  render: function() {
    const state = this.state;
    const okayStatuses = state.okayStatuses;
    const disableSubmit = _.includes(_.values(okayStatuses), false);
    const emailTypedOkTwice = okayStatuses.email && this.state.email === this.state.email2;
    const isComments = this.state.pricePlan === PricePlan.EmbeddedComments;
    const embeddingOriginOrLocalHostname = isComments
      ? EmbeddingAddressInput({
          style: { display: state.showAddress ? 'block' : 'none' },
          onChangeValueOk: (value, isOk) => {
            this.setState({ embeddingOrigin: value });
            this.reportOkay('address', isOk)
          } })
      : LocalHostnameInput({ label: "Site Address:", placeholder: 'your-forum-name',
            style: { display: state.showAddress ? 'block' : 'none' },
            help: "The address of your new site. You can change this later,  " +
                "e.g. to a custom domain.",
            ref: 'localHostname',
            onChangeValueOk: (value, isOk) => this.reportOkay('address', isOk) });

    return (
      r.div({},
        r.h1({}, isComments ? "Create Embedded Comments" : "Create Forum"),
        r.form({ className: 'esCreateSite', onSubmit: this.handleSubmit },
          EmailInput({ label: "Your email:", id: 'e2eEmail', className: 'esCreateSite_email',
              placeholder: 'your-email@example.com',
              help: "Your email address, which you will use to login and administrate " +
                (isComments ? "comments." : "the site."), ref: 'emailAddress',
              onChangeValueOk: (value, isOk) => {
                this.setState({ email: value });
                this.reportOkay('email', isOk)
              } }),

          NextStepButton({ onShowNextStep: () => this.setState({ showEmail2: true }),
              showThisStep: okayStatuses.email && !state.showEmail2, id: 'e2eNext1' },
            "Next"),

          PatternInput({ label: 'Verify email:', id: 'e2eEmail2', className: 'esCreateSite_email',
            style: { display: state.showEmail2 ? 'block' : 'none' },
            placeholder: 'your-email@example.com',
            error: !emailTypedOkTwice,
            help: "Please type your email again.", ref: 'emailAddress2',
            onChangeValueOk: (value, isOk) => {
              this.setState({ email2: value });
              this.reportOkay('email2', isOk && value === this.state.email)
            } }),

          NextStepButton({ onShowNextStep: () => this.setState({ showAddress: true }),
              showThisStep: emailTypedOkTwice && !state.showAddress, id: 'e2eNext2' },
            "Next"),

          embeddingOriginOrLocalHostname,

          NextStepButton({ onShowNextStep: () => this.setState({ showRemaining: true }),
              showThisStep: okayStatuses.address && !state.showRemaining, id: 'e2eNext3' },
            "Next (the last)"),

          PatternInput({ label: "Organization name:", placeholder: "Your Organization Name",
              style: { display: state.showRemaining ? 'block' : 'none' },
              help: "The name of your organization, if any. Otherwise, you " +
                "can use your own name. Will be used in your Terms of Use " +
                "and Privacy Policy documents.",
              ref: 'organizationName', id: 'e2eOrgName',
              regex: /\S/, message: "Name required",
              onChangeValueOk: (value, isOk) => this.reportOkay('orgName', isOk) }),

          r.div({ style: { display: state.showRemaining ? 'block' : 'none' }},
            AcceptTerms({ reportOkay: (isOk) => this.reportOkay('terms', isOk) }),

            InputTypeSubmit({ value: "Create Site", disabled: disableSubmit })))));
  }
});


function NextStepButton(props, text) {
  // Listen to onFocus, so the next field will appear directly when one tabs
  // away from the previous field. onFocus apparently works with mouse & touch too.
  // However, onFocus apparently does *not* work in Safari, so listen to onClick too.
  return (
      PrimaryButton({ onClick: props.onShowNextStep, onFocus: props.onShowNextStep,
          style: { display: props.showThisStep ? 'block' : 'none' }, id: props.id },
        text));
}



export function EmbeddingAddressInput(props) {
  return (
    PatternInput({ label: props.label || "Embedding site:",
      id: 'e_EmbeddingOrigin', className: '',
      style: props.style,
      placeholder: 'https://your.website.com',
      help: props.help || "The address of your blog / website where you're adding the comments.",
      ref: 'embeddingOrigin',
      regex: /\S/, message: "Address required",
      regexTwo: /^https?:\/\/[^/]+/, messageTwo: "Should be http(s)://something...",
      notRegex: /\S\s\S/, notMessage: "No spaces please",
      notRegexTwo: /[@#\?]/, notMessageTwo: "No weird characters please (e.g. not @#?)",
      onChangeValueOk: props.onChangeValueOk }));
}



const AcceptTerms = createClassAndFactory({
  onChange: function(e) {
    this.props.reportOkay(this.refs.checkbox.getChecked());
  },

  render: function() {
    const label =
      r.span({},
          'I accept the ',
          r.a({ href: '/-/terms-of-use', target: '_blank'}, 'Terms of Use'),
          ' and the ',
          r.a({ href: '/-/privacy-policy', target: '_blank' }, 'Privacy Policy'));

    return (
      Input({ type: 'checkbox', label: label, ref: 'checkbox', id: 'e2eAcceptTerms',
          onChange: this.onChange }));
  }
});



/**
 * Don't make the domain editable at this point, because then some people would edit it,
 * without realizing or remembering that they need to update their domain name server
 * records before this'll work. So instead: 1) let people create a default-domain site,
 * and later 2) let them connect it to their own main domain, from the admin pages.
 * Then they can return to the default-domain address, if they mess up, and fix things.
 */
const LocalHostnameInput = createClassAndFactory({
  contextTypes: {
    router: React.PropTypes.object.isRequired
  },

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

    if (/\./.test(value))
      return "No dots please";

    if (/\s/.test(value))
      return "No spaces please";

    if (/^[0-9].*/.test(value))
      return "Don't start with a digit";

    if (!/^[a-z0-9-]*$/.test(value))
      return "Use only letters a-z and 0-9, e.g. 'my-new-website'";

    if (/.*-$/.test(value))
      return "Don't end with a dash (-)";

    if (value.length < 6 && !anyForbiddenPassword())
      return "Type at least six characters";

    if (value.length < 2)
      return 'Too short'; // a server side regex requires >= 2 chars

    return null;
  },

  render: function() {
    var value = this.state.value;
    var anyError;
    if (this.state.showErrors) {
      var anyError = this.findAnyError();
      if (anyError) {
        anyError = r.b({ style: { color: 'red' }}, anyError);
      }
    }
    // Check the router state, not location pathname, later after having upgr to react-router-
    // -some-version-for-which-the-docs-works.
    var testSitePrefix = // dupl code [5UKF03]
        location.pathname.indexOf('create-test-site') !== -1 ? 'test--' : '';
    return (
      r.div({ className: 'form-group' + (anyError ? ' has-error' : ''), style: this.props.style },
        r.label({ htmlFor: 'dwLocalHostname' }, this.props.label),
        r.br(),
        r.kbd({}, location.protocol + '//' + testSitePrefix),
        r.input({ type: 'text', id: 'dwLocalHostname', className: 'form-control',
            placeholder: this.props.placeholder, ref: 'input', onChange: this.onChange,
            value: value, onFocus: this.showErrors }),
        r.kbd({}, '.' + debiki.baseDomain),
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
