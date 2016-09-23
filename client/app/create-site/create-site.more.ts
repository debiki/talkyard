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

/// <reference path="../../typedefs/react/react.d.ts" />
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

var ReactRouter = window['ReactRouter'];
var Route = reactCreateFactory(ReactRouter.Route);
var IndexRoute = reactCreateFactory(ReactRouter.IndexRoute);
var Redirect = reactCreateFactory(ReactRouter.Redirect);



export function routes() {
  return [
    Redirect({ key: 'redir', from: '/-/create-site/', to: '/-/create-site' }),
    Route({ key: 'routes', path: '/-/create-site', component: CreateSomethingComponent },
      /* Later, if one should choose between a site and embedded comments:
       IndexRoute({ handler: ChooseSiteTypeComponent }),
       Route({ path: 'website', handler: CreateWebsiteComponent }),
       */
      IndexRoute({ component: CreateWebsiteComponent }),
      Route({ path: 'embedded-comments', component: CreateEmbeddedSiteComponent })),
    Route({ key: 'test-routes', path: '/-/create-test-site', component: CreateSomethingComponent },
      IndexRoute({ component: CreateWebsiteComponent }),
      Route({ path: 'embedded-comments', component: CreateEmbeddedSiteComponent }))];
}



var CreateSomethingComponent = React.createClass({
  displayName: 'CreateSiteComponent',

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


/* Later, if I make embedded comments work again:
var ChooseSiteTypeComponent = React.createClass({
  goToCreateSimpleSite: function() {
    this.transitionTo('create-simple-site');
  },

  goToCreateEmbeddedSite: function() {
    this.transitionTo('create-embedded-comments');
  },

  render: function() {
    return r.div({},
      r.h1({}, 'Choose Site Type'),
      r.p({}, 'What do you want to create? (You can change your mind later.)'),
      r.div({},
        Button({ onClick: this.goToCreateSimpleSite }, 'A forum, bog or simple website')));
        // Button({ onClick: this.goToCreateEmbeddedSite }, 'Embedded comments')));
  }
}); */



var CreateWebsiteComponent = React.createClass(<any> {
  displayName: 'CreateSimpleSiteComponent',

  getInitialState: function() {
    return {
      okayStatuses: {
        email: false,
        email2: false,
        hostname: false,
        orgName: false,
        terms: false,
      },
      email: '',
      email2: null,
      showEmail2: false,
    };
  },

  componentDidUpdate: function(prevProps, prevState) {
    if (this.state.showEmail2 && !prevState.showEmail2) {
      this.refs.emailAddress2.focus();
    }
    if (this.state.showHostname && !prevState.showHostname) {
      this.refs.localHostname.focus();
    }
    if (this.state.showRemaining && !prevState.showRemaining) {
      this.refs.organizationName.focus();
    }
  },

  handleSubmit: function(event) {
    var testSitePrefix = // dupl code [5UKF03]
      location.pathname.indexOf('create-test-site') !== -1 ? 'test--' : '';

    // Later: add Non-Commercial or Hobby / Business checkbox.
    var pricePlan = PricePlan.Unknown;
    if (location.hash.indexOf('non-commercial') !== -1) pricePlan = PricePlan.NonCommercial;
    if (location.hash.indexOf('business') !== -1) pricePlan = PricePlan.Business;

    event.preventDefault();
    Server.createSite(
        this.refs.emailAddress.getValue(),
        testSitePrefix + this.refs.localHostname.getValue(),
        null,
        this.refs.organizationName.getValue(),
        pricePlan,
        (newSiteOrigin) => {
          window.location.assign(newSiteOrigin);
        });
  },

  reportOkay: function(what, isOk) {
    var okayStatuses = this.state.okayStatuses;
    okayStatuses[what] = isOk;
    this.setState({ okayStatuses: okayStatuses });
  },

  render: function() {
    var state = this.state;
    var okayStatuses = state.okayStatuses;
    var disableSubmit = _.includes(_.values(okayStatuses), false);
    var emailTypedOkTwice = okayStatuses.email && this.state.email === this.state.email2;
    return (
      r.div({},
        r.h1({}, 'Create Forum'),
        r.form({ className: 'esCreateSite', onSubmit: this.handleSubmit },
          EmailInput({ label: "Your email:", id: 'e2eEmail', className: 'esCreateSite_email',
              placeholder: 'your-email@example.com',
              help: 'Your email address, which you will use to login and ' +
                'administrate the site.', ref: 'emailAddress',
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
            help: 'Please type your email again.', ref: 'emailAddress2',
            onChangeValueOk: (value, isOk) => {
              this.setState({ email2: value });
              this.reportOkay('email2', isOk && value === this.state.email)
            } }),

          NextStepButton({ onShowNextStep: () => this.setState({ showHostname: true }),
              showThisStep: emailTypedOkTwice && !state.showHostname, id: 'e2eNext2' },
            "Next"),

          LocalHostnameInput({ label: 'Site Address:', placeholder: 'your-forum-name',
              style: { display: state.showHostname ? 'block' : 'none' },
              help: "The address of your new site. You can change this later,  " +
                  "e.g. to a custom domain.",
              ref: 'localHostname',
              onChangeValueOk: (isOk) => this.reportOkay('hostname', isOk) }),

          NextStepButton({ onShowNextStep: () => this.setState({ showRemaining: true }),
              showThisStep: okayStatuses.hostname && !state.showRemaining, id: 'e2eNext3' },
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
            AcceptTerms({ reportOkay: (isOk) => this.reportOkay('terms', isOk),
                ref: 'acceptTerms' }),

            InputTypeSubmit({ value: 'Create Site', disabled: disableSubmit })))));
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



// Currently not in use; embedded comments disabled & broken right now.
var CreateEmbeddedSiteComponent = React.createClass(<any> {
  displayName: 'CreateEmbeddedSiteComponent',

  getInitialState: function() {
    return { showErrors: false };
  },

  handleSubmit: function(event) {
    event.preventDefault();
    var anyError =
        !this.refs.terms.areTermsAccepted() ||
        this.refs.localHostname.findAnyError() ||
        !this.refs.embeddingSiteAddress.isValid();
        // COULD test email too
    if (anyError) {
      this.setState({ showErrors: true });
      return;
    }
    die("unimpl [EsE5YKUFQ32]"); /*
    Server.createSite(
        this.refs.emailAddress.getValue(),
        this.refs.localHostname.getValue(),
        this.refs.embeddingSiteAddress.getValue(),
         ??? organizationName.getValue(),  ?? this field is missing
        (newSiteOrigin) => {
          window.location.assign(newSiteOrigin);
        }); */
  },

  updateDebikiAddress: function() {
    var newEmbeddingSiteAddress = this.refs.embeddingSiteAddress.getValue();
    var newLocalHostname = deriveLocalHostname(newEmbeddingSiteAddress);
    this.refs.localHostname.setValue(newLocalHostname);
  },

  render: function() {
    return (
      r.div({},
        r.h1({}, 'Create Embedded Site'),
        r.form({ onSubmit: this.handleSubmit },
          Input({ type: 'text', label: 'Email:', placeholder: 'your-email@example.com',
              help: 'Your email address, which you will use to login and moderate comments.',
              ref: 'emailAddress' }),

          EmbeddingAddressInput({ ref: 'embeddingSiteAddress',
              onChange: this.updateDebikiAddress }),

          LocalHostnameInput({ label: 'Debiki Address', ref: 'localHostname',
              help: 'This is where you login to moderate embedded comments.' }),

          AcceptTerms({ ref: 'terms' }),

          InputTypeSubmit({ value: "Create Site" }))));
  }
});



// Currently not in use; embedded comments disabled & broken right now.
export var EmbeddingAddressInput = createClassAndFactory({
  getInitialState: function() {
    return { bsStyle: 'error' };
  },
  isValid: function() {
    var value = this.refs.input.getValue();
    var valid = /https?:\/\/.+/.test(value);
    return valid;
  },
  getValue: function() {
    return this.refs.input.getValue();
  },
  onChange: function(event) {
    this.setState({ bsStyle: this.isValid() ? 'success' : 'error' });
    if (this.props.onChange) {
      this.props.onChange(event);
    }
  },
  render: function() {
    return (
      Input({ type: 'text', label: this.props.label || 'Embedding Site Address',
        placeholder: 'https://www.example.com', onChange: this.onChange,
        ref: 'input', bsStyle: this.state.bsStyle, help: this.props.help ||
          'The address of the website where the embedded comments should appear.' }));
  }
});



var AcceptTerms = createClassAndFactory({
  onChange: function(e) {
    this.props.reportOkay(this.refs.checkbox.getChecked());
  },

  focus: function() {
    // Apparently Input has no focus() method, so:
    $(ReactDOM.findDOMNode(this)).find('input').focus();
  },

  render: function() {
    var label =
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
var LocalHostnameInput = createClassAndFactory({
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
    this.setState({ value: event.target.value.toLowerCase() });
    var anyError = this.findAnyError(event.target.value);
    this.props.onChangeValueOk(!anyError);
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
