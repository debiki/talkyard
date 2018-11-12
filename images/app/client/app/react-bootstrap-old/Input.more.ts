/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const FormGroup = rb.FormGroup;
const ControlLabel = rb.ControlLabel;
const FormControl = rb.FormControl;
const HelpBlock = rb.HelpBlock;
const Checkbox = rb.Checkbox;
const Radio = rb.Radio;
const InputGroupAddon = rb.InputGroupAddon;

export const Input = createComponent({
  displayName: 'Input',

  getValue: function() {
    return ReactDOM.findDOMNode(this.refs.theInput)['value'];
  },

  getChecked: function() {
    // @ifdef DEBUG
    dieIf(this.props.type === 'radio', "getChecked doesn't work with radio buttons [EdE7WKP02]");
    // @endif
    return ReactDOM.findDOMNode(this.refs.theInput)['checked'];
  },

  getInputDOMNode: function() {
    return ReactDOM.findDOMNode(this.refs.theInput);
  },

  // @ifdef DEBUG
  focus: function() {
    // Previously:
    // $ (ReactDOM.findDOMNode(this)).find('input').focus();
    // Now, untested:
    // Bliss('input', ReactDOM.findDOMNode(this)).focus();
    die('untested [EdE3KDPYWW9]');
  },
  // @endif

  render: function() {
    // Styles ignored — is not obvious on which elem they should be placed? Better use CSS classes?
    // @ifdef DEBUG
    dieIf(this.props.style, 'TyE4KKWBG20');
    // @endif

    const props = this.props;
    const childProps: any = {
      ref: 'theInput',
      id: props.id,
      name: props.name,
      bsClass: props.bsClass,
      disabled: props.disabled,
      inputRef: props.inputRef,
      onChange: props.onChange,
      onFocus: props.onFocus,
      onBlur: props.onBlur,
      tabIndex: props.tabIndex,
    };

    const isCheckbox = props.type === 'checkbox';
    const isRadio = props.type === 'radio';

    if (isCheckbox || isRadio) {
      childProps.inline = props.inline;
      childProps.title = props.title;
      childProps.validationState = props.validationState;
      childProps.checked = props.checked;
      childProps.defaultChecked = props.defaultChecked;
    }
    else {
      childProps.bsSize = props.bsSize;
      childProps.componentClass =
          props.type === 'select' || props.type === 'textarea' ? props.type : undefined;
      childProps.type = props.type;
      childProps.placeholder = props.placeholder;
      childProps.value = props.value;
      childProps.defaultValue = props.defaultValue;
    }

    const addonBefore = !props.addonBefore ? null : InputGroupAddon({}, props.addonBefore);

    let result;
    if ((isCheckbox || isRadio) && !props.labelFirst) {
      result = (
        r.div({ className: 'form-group ' + (props.className || '') },
          r.div({ className: props.wrapperClassName },
            (isRadio ? Radio : Checkbox).call(null, childProps, props.label),
            r.span({ className: 'help-block' },
              props.help))));
    }
    else if (props.type === 'custom') {
      result = (
        FormGroup({ className: this.props.className },
          props.label && ControlLabel({ className: props.labelClassName }, props.label),
          r.div({ className: props.wrapperClassName },
            props.children)));
    }
    else {
      let theInput;
      let anyHelp;
      if (isCheckbox || isRadio) {
        dieIf(!props.labelFirst, 'EdE2WR8L9');
        // The help will become the checkbox label, so if it's clicked, the checkbox gets selected.
        theInput = (isRadio ? Radio : Checkbox).call(null, childProps, props.help);
      }
      else {
        theInput = FormControl(childProps, props.children);
        anyHelp = props.help && HelpBlock({}, props.help);
      }
      result = (
        FormGroup({ className: this.props.className },
          props.label && ControlLabel({ className: props.labelClassName }, props.label),
          r.div({ className: props.wrapperClassName },
            r.div({ className: 'input-group' },
              addonBefore,
              theInput),
            anyHelp)));
    }

    return result;
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
