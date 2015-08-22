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
/// <reference path="../renderer/model.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.admin {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);


/**
 * Requires that `this.state` is a map of all settings that can be saved.
 */
export var SaveSettingMixin = {
  saveSetting: function(setting, editedValue) {
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
  },
}



export var Setting = createComponent({
  componentWillMount: function() {
    this.setState({
      editedValue: this.savedValue()
    });
  },

  isTextSetting: function() {
    return typeof this.savedValue() === 'string';
  },

  isBoolSetting: function() {
    return typeof this.savedValue() === 'boolean';
  },

  savedValue: function() {
    var setting: SettingFromServer<any> = this.props.setting;
    var savedValue =
      _.isUndefined(setting.anyAssignedValue) ? setting.defaultValue : setting.anyAssignedValue;
    return savedValue;
  },

  onEdit: function(event) {
    var newValue = this.isTextSetting() ? event.target.value : event.target.checked;
    this.setState({
      editedValue: newValue
    });
  },

  cancelEdits: function() {
    this.setState({
      editedValue: this.savedValue()
    });
  },

  resetValue: function() {
    this.setState({
      editedValue: this.props.setting.defaultValue
    });
  },

  render: function() {
    var setting: SettingFromServer<any> = this.props.setting;
    var id = 'setting-' + setting.name;
    var editedValue = this.state.editedValue;

    var isTextSetting = this.isTextSetting();
    var isBoolSetting = this.isBoolSetting();

    var editableValue;
    if (isTextSetting) {
      var inputType = this.props.multiline ? 'textarea' : 'input';
      editableValue = r[inputType]({ type: 'text', className: 'form-control',
          id: id, value: editedValue, onChange: this.onEdit });
    }
    else if (isBoolSetting) {
      editableValue =
        r.div({ className: 'checkbox' },
          r.input({ type: 'checkbox', id: id, checked: editedValue, onChange: this.onEdit }));
    }
    else {
      console.error('Unkonwn setting type [DwE5XE30]');
      return r.p({}, 'Unkonwn setting type.');
    }

    var saveResetBtns;
    var valueChanged = editedValue !== this.savedValue();
    var hasDefaultValue = editedValue === setting.defaultValue;
    if (valueChanged) {
      saveResetBtns =
        r.div({ className: 'col-sm-3' },
          Button({ onClick: () => this.props.onSave(setting, this.state.editedValue) }, 'Save'),
          Button({ onClick: this.cancelEdits }, 'Cancel'));
    }
    else if (!valueChanged && !hasDefaultValue) {
      saveResetBtns =
        r.div({ className: 'col-sm-3' },
          Button({ onClick: this.resetValue }, 'Reset to default'));
    }

    var boolClass = isBoolSetting ? ' bool-setting' : '';
    var defaultValue = isBoolSetting
        ? r.span({}, ' Default value: ', r.samp({}, setting.defaultValue ? 'true' : 'false'))
        : r.span({}, ' Default value: "', r.samp({}, setting.defaultValue), '"');

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
