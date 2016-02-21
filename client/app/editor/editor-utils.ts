/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   module debiki2.editor {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);


export var PageRoleInput = createComponent({
  render: function() {
    var me: Myself = this.props.me;
    var complicated = this.props.complicated;

    var wikiMindMap = complicated ? r.option({ value: PageRole.MindMap }, "Wiki Mind Map") : null;

    var divider;
    var openChatOption;
    var privateChatOption;
    var customHtmlPageOption;
    if (me.isAdmin) {
      openChatOption = r.option({ value: PageRole.OpenChat }, "Chat room");
      // Not yet implemented:
      // privateChatOption = r.option({ value: PageRole.PrivateChat }, "Private chat");

      if (complicated) {
        divider = r.option({ disabled: true }, "");
        customHtmlPageOption = r.option({ value: PageRole.HomePage }, "Custom HTML page");
      }
    }

    return (
      Input({
          type: 'select',
          title: this.props.title || "Page type",
          label: this.props.label,
          labelClassName: this.props.labelClassName,
          wrapperClassName: this.props.wrapperClassName,
          value: this.props.value,
          defaultValue: this.props.defaultValue,
          onChange: this.props.onChange,
        },
        r.option({ value: PageRole.Discussion }, 'Discussion'),
        r.option({ value: PageRole.Question }, 'Question'),
        r.option({ value: PageRole.Problem }, 'Problem'),
        r.option({ value: PageRole.Idea }, 'Idea'),
        r.option({ value: PageRole.ToDo }, 'Todo'),
        // r.option({ value: PageRole.WikiPage }, 'Wiki'), -- if 1d layout is default?
        wikiMindMap,
        divider,
        customHtmlPageOption,
        openChatOption,
        privateChatOption));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
