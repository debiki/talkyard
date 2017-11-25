/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
let FormGroup = rb.FormGroup;
let ControlLabel = rb.ControlLabel;
let FormControl = rb.FormControl;
let HelpBlock = rb.HelpBlock;
let Checkbox = rb.Checkbox;
let Radio = rb.Radio;
let InputGroupAddon = rb.InputGroupAddon;

export var Input = createComponent({
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
    var props = this.props;
    var childProps = _.clone(props);
    childProps.ref = 'theInput';

    function makeCheckboxRadioProps() {
      return {
        ref: 'theInput',
        id: props.id,
        name: props.name,
        bsClass: props.bsClass,
        disabled: props.disabled,
        inline: props.inline,
        inputRef: props.inputRef,
        title: props.title,
        validationState: props.validationState,
        checked: props.checked,
        defaultChecked: props.defaultChecked,
        onChange: props.onChange,
      };
    }

    function makeFormControlProps() {
      return {
        ref: 'theInput',
        id: props.id,
        name: props.name,
        bsClass: props.bsClass,
        bsSize: props.bsSize,
        disabled: props.disabled,
        inputRef: props.inputRef,
        componentClass: props.type === 'select' || props.type === 'textarea' ? props.type : undefined,
        type: props.type,
        placeholder: props.placeholder,
        value: props.value,
        defaultValue: props.defaultValue,
        onChange: props.onChange,
      };
    }

    let addonBefore = !props.addonBefore ? null : InputGroupAddon({}, props.addonBefore);

    let result;
    let isCheckbox = props.type === 'checkbox';
    let isRadio = props.type === 'radio';
    if ((isCheckbox || isRadio) && !props.labelFirst) {
      result = (
        r.div({ className: 'form-group ' + (props.className || '') },
          r.div({ className: props.wrapperClassName },
            (isRadio ? Radio : Checkbox).call(null, makeCheckboxRadioProps(), props.label),
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
        theInput = (isRadio ? Radio : Checkbox).call(null, makeCheckboxRadioProps(), props.help);
      }
      else {
        theInput = FormControl(makeFormControlProps(), props.children);
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
