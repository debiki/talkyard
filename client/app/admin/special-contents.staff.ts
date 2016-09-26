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
/// <reference path="../more-bundle-already-loaded.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.admin {
//------------------------------------------------------------------------------

var r = React.DOM;
var PageUnloadAlerter = utils.PageUnloadAlerter;


export var SpecialContent = createComponent({
  componentWillMount: function() {
    Server.loadSpecialContent(this.props.rootPageId, this.props.contentId, content => {
      this.setState({
        content: content,
        editedText: this.savedText(content)
      });
    });
  },

  saveEdits: function() {
    var content = $.extend({}, this.state.content, { anyCustomText: this.state.editedText });
    Server.saveSpecialContent(content, () => {
      this.setState({ content: content });
      this.cancelForgotToSaveWarning();
    });
  },

  savedText: function(anyContent?: SpecialContent) {
    var content: SpecialContent = anyContent || this.state.content;
    return content.anyCustomText || content.defaultText;
  },

  cancelEdits: function() {
    this.setState({ editedText: this.savedText() });
    this.cancelForgotToSaveWarning();
  },

  resetText: function() {
    this.setState({ editedText: this.state.content.defaultText });
    this.warnIfForgettingToSave();
  },

  onEdit: function(event) {
    this.setState({ editedText: event.target.value });
    if (event.target.value !== this.savedText()) {
      this.warnIfForgettingToSave();
    }
    else {
      this.cancelForgotToSaveWarning();
    }
  },

  warnIfForgettingToSave: function() {
    PageUnloadAlerter.addReplaceWarning('SpC-' + this.props.contentId, "You have unsaved edits");
  },

  cancelForgotToSaveWarning: function() {
    PageUnloadAlerter.removeWarning('SpC-' + this.props.contentId);
  },

  render: function() {
    if (!this.state || !this.state.content)
      return null;

    var content: SpecialContent = this.state.content;
    var editedText = this.state.editedText;

    var saveResetBtns;
    var textChanged = editedText !== this.savedText();
    var hasDefaultText = editedText === content.defaultText;
    if (textChanged) {
      saveResetBtns =
        r.div({},
          PrimaryButton({ onClick: this.saveEdits }, "Save"),
          Button({ onClick: this.cancelEdits }, 'Cancel'));
    }
    else if (!textChanged && !hasDefaultText) {
      saveResetBtns =
        r.div({},
          Button({ onClick: this.resetText }, 'Reset to default'));
    }

    return (
      r.div({ className: 'form-group row special-content' },
        r.label({ htmlFor: content.rootPageId + content.contentId,
            className: 'col-sm-2 control-label' }, this.props.label),
        r.div({ className: 'col-sm-10' },
          r.p({}, this.props.help),
          r.textarea({ className: 'form-control special-content-' + content.contentId,
              id: content.rootPageId + content.contentId, value: editedText,
              onChange: this.onEdit, placeholder: this.props.placeholder }),
          saveResetBtns)));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
