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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../model.ts" />
/// <reference path="../Server.ts" />
/// <reference path="../utils/PageUnloadAlerter.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var PageUnloadAlerter = utils.PageUnloadAlerter;


/**
 * Requires that `this.state` is a map of all settings that can be saved.
 */
export var SaveSettingMixin = {  ///xx
  saveSetting: function(setting, editedValue) {
    die('strnseintrs'); /*
    var settingToSave: Setting = {
      type: 'WholeSite',
      name: setting.name,
      newValue: editedValue
    };
    Server.saveSetting(settingToSave, () => {
      var newState = {};
      newState[setting.name] = this.state[setting.name];
      newState[setting.name].anyAssignedValue = editedValue;
      this.setState(newState);
    });
    */
  },
};



export var Setting = createComponent({  //xx
  componentWillMount: function() {
    this.setState({
      editedValue: this.savedValue()
    });
  },

  isTextSetting: function() {
    return _.isString(this.props.setting.defaultValue);
  },

  isNumberSetting: function() {
    return _.isNumber(this.props.setting.defaultValue);
  },

  isBoolSetting: function() {
    return _.isBoolean(this.props.setting.defaultValue);
  },

  savedValue: function() {
    var setting: SettingFromServer<any> = this.props.setting;
    return _.isUndefined(setting.anyAssignedValue) ?
        setting.defaultValue : setting.anyAssignedValue;
  },

  onEdit: function(event) {
    var newValue;
    if (this.isTextSetting()) newValue = event.target.value;
    else if (this.isNumberSetting()) newValue = parseInt(event.target.value);
    else if (this.isBoolSetting()) newValue = event.target.checked;
    else die('EsE5GYKW2');
    this.setState({
      editedValue: newValue
    });
    if (newValue !== this.savedValue()) {
      this.warnIfForgettingToSave();
    }
    else {
      this.cancelForgotToSaveWarning();
    }
  },

  saveEdits: function() {
    this.props.onSave(this.props.setting, this.state.editedValue);
    // (COULD add onSave callback and remove the unload warning only if the save request succeeds.)
    this.cancelForgotToSaveWarning();
  },

  cancelEdits: function() {
    this.setState({
      editedValue: this.savedValue()
    });
    this.cancelForgotToSaveWarning();
  },

  resetValue: function() {
    this.setState({
      editedValue: this.props.placeholder ? '' : this.props.setting.defaultValue
    });
    this.warnIfForgettingToSave();
  },

  warnIfForgettingToSave: function() {
    PageUnloadAlerter.addReplaceWarning(
        'Setting-' + this.props.setting.name, "You have unsaved changes. " +
          "Click Cancel or Don't Reload below to keep your changes and continue editing.");
  },

  cancelForgotToSaveWarning: function() {
    PageUnloadAlerter.removeWarning('Setting-' + this.props.setting.name);
  },

  render: function() {
    var setting: SettingFromServer<any> = this.props.setting;
    var id = 'setting-' + setting.name;
    var editedValue = this.state.editedValue;

    var isTextSetting = this.isTextSetting();
    var isNumberSetting = this.isNumberSetting();
    var isBoolSetting = this.isBoolSetting();

    var editableValue;
    if (isTextSetting) {
      var inputType = this.props.multiline ? 'textarea' : 'input';
      var editedValueOrEmpty = !this.props.placeholder
          ? editedValue
          : (editedValue === setting.defaultValue ? '' : editedValue);
      editableValue = r[inputType]({ type: 'text', className: 'form-control', id: id,
          value: editedValueOrEmpty, onChange: this.onEdit, placeholder: this.props.placeholder });
    }
    else if (isNumberSetting) {
      editableValue = r.input({ type: 'number', className: 'form-control', id: id,
          value: this.state.editedValue, onChange: this.onEdit,
          placeholder: this.props.placeholder });
    }
    else if (isBoolSetting) {
      editableValue =
        r.div({ className: 'checkbox' },
          r.input({ type: 'checkbox', id: id, checked: editedValue, onChange: this.onEdit }));
    }
    else {
      // Don't die() — that would let a buggy plugin make the whole page unusable?
      var message = "Unkonwn setting type. Setting name: '" + setting.name + "' [DwE5XE30]";
      console.error(message);
      return r.p({}, message);
    }

    var saveResetBtns;
    var valueChanged = editedValue !== this.savedValue();
    var hasDefaultValue = isNullOrUndefined(editedValue) || editedValue === setting.defaultValue;
    if (valueChanged) {
      saveResetBtns =
        r.div({ className: 'col-sm-3' },
          Button({ onClick: this.saveEdits, bsStyle: 'primary' }, "Save"),
          Button({ onClick: this.cancelEdits }, 'Cancel'));
    }
    else if (!valueChanged && !hasDefaultValue) {
      saveResetBtns =
        r.div({ className: 'col-sm-3' },
          Button({ onClick: this.resetValue }, 'Reset to default'));
    }

    var boolClass = isBoolSetting ? ' bool-setting' : '';
    var defaultValue = this.props.placeholder ? null : (
      isBoolSetting
        ? r.span({}, ' Default value: ', r.samp({}, setting.defaultValue ? 'true' : 'false'))
        : r.span({}, ' Default value: "', r.samp({}, setting.defaultValue), '"'));

    return (
      r.div({ className: 'fourm-group row'},
        r.label({ htmlFor: id, className: 'col-sm-2 control-label setting-label' },
            this.props.label),
        r.div({ className: 'col-sm-7' + boolClass },
          editableValue,
          r.p({}, this.props.help, defaultValue)),
        saveResetBtns));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
