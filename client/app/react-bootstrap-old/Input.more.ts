/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   module debiki2 {
//------------------------------------------------------------------------------

var r = React.DOM;
var ReactBootstrap: any = window['ReactBootstrap'];
var FormGroup = reactCreateFactory(ReactBootstrap.FormGroup);
var ControlLabel = reactCreateFactory(ReactBootstrap.ControlLabel);
var FormControl = reactCreateFactory(ReactBootstrap.FormControl);
var HelpBlock = reactCreateFactory(ReactBootstrap.HelpBlock);
var Checkbox = reactCreateFactory(ReactBootstrap.Checkbox);

export var Input = createComponent({
  getValue: function() {
    return ReactDOM.findDOMNode(this.refs.theInput)['value'];
  },

  getChecked: function() {
    return ReactDOM.findDOMNode(this.refs.theInput)['checked'];
  },

  render: function() {
    var props = this.props;
    dieIf(props.type === 'radio', 'no radio [EsE45WWP9]');  // EsE_MORE_UNIMPL

    var childProps = _.clone(props);
    childProps.ref = 'theInput';
    childProps.id = props.inputId;
    delete childProps.inputId;
    delete childProps.label;
    delete childProps.children;
    delete childProps.help;

    if (props.type === 'select' || props.type === 'textarea') {
      childProps.componentClass = props.type;
    }

    var result;
    if (props.type === 'checkbox') {
      result = (
        r.div({ className: 'form-group' },
          r.div({ className: props.wrapperClassName },
            Checkbox(childProps, props.label),
            r.span({ className: 'help-block' },
              props.help))));
    }
    else if (props.type === 'custom') {
      result = (
        FormGroup({controlId: props.id},
          props.label && ControlLabel({ className: props.labelClassName }, props.label),
          r.div({ className: props.wrapperClassName },
            props.children)));
    }
    else {
      result = (
        FormGroup({controlId: props.id},
          props.label && ControlLabel({ className: props.labelClassName }, props.label),
          r.div({ className: props.wrapperClassName },
            FormControl(childProps, props.children),
            props.help && HelpBlock({}, props.help))));
    }

    return result;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
