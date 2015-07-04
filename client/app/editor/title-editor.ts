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

/// <reference path="../../shared/plain-old-javascript.d.ts" />
/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/modernizr/modernizr.d.ts" />
/// <reference path="../renderer/model.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   module debiki2.titleeditor {
//------------------------------------------------------------------------------

var d = { i: debiki.internal, u: debiki.v0.util };
var r = React.DOM;
var reactCreateFactory = React['createFactory'];
var ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
var ReactBootstrap: any = window['ReactBootstrap'];
var Button = reactCreateFactory(ReactBootstrap.Button);
var Input = reactCreateFactory(ReactBootstrap.Input);
var $: any = window['jQuery'];


export var TitleEditor = createComponent({
  getInitialState: function() {
    return {
      showComplicated: false,
      isSaving: false
    };
  },

  toggleComplicated: function() {
    this.setState({
      showComplicated: !this.state.showComplicated
    });
  },

  save: function() {
    this.setState({ isSaving: true });
    var newTitle = this.refs.titleInput.getValue();
    var pageSettings = this.getSettings();
    Server.savePageTitleAndSettings(newTitle, pageSettings, this.props.closeEditor, () => {
      this.setState({ isSaving: false });
    });
  },

  getSettings: function() {
    var settings: any = {};
    if (this.refs.layoutInput) {
      settings.layout = this.refs.layoutInput.getValue();
    }
    if (this.refs.folderInput) {
      settings.folder = this.refs.folderInput.getValue();
    }
    if (this.refs.slugInput) {
      settings.slug = this.refs.slugInput.getValue();
    }
    if (this.refs.showIdInput) {
      settings.showId = this.refs.showIdInput.getChecked();
    }
    return settings;
  },

  render: function() {
    var titlePost: Post = this.props.allPosts[TitleId];
    var titleText = titlePost.sanitizedHtml; // for now. TODO only allow plain text?

    var complicatedStuff;
    if (this.state.showComplicated) {
      complicatedStuff =
        r.div({ className: 'container' },
          r.form({ className: 'dw-compl-stuff form-horizontal', key: 'compl-stuff-key' },
            Input({ type: 'select', ref: 'layoutInput', className: 'dw-i-layout' },
              r.option({ value: 'DefaultLayout' }, 'Default Layout'),
              r.option({ value: 'OneColumnLayout' }, 'One Column'),
              r.option({ value: '2DTreeLayout' }, '2D Tree')),
            Input({ label: 'Slug', type: 'text', ref: 'slugInput', className: 'dw-i-slug',
                defaultValue: getCurrentSlug() }),
            Input({ label: 'Folder', type: 'text', ref: 'folderInput', className: 'dw-i-folder',
                defaultValue: getCurrentUrlPathFolder() }),
            Input({ label: 'Show page ID', type: 'checkbox', ref: 'showIdInput',
                className: 'dw-i-showid', defaultChecked: isIdShownInUrl() })));
    }

    // Once the complicated stuff has been shown, one cannot hide it, except by cancelling
    // the whole dialog. Because if hiding it, then what about any changes made? Save or ignore?
    var showAdvancedButton = this.state.showComplicated
        ? null
        : r.a({ className: 'dw-toggle-compl-stuff icon-settings',
            onClick: this.toggleComplicated }, 'Advanced');

    var saveCancel = this.state.isSaving
      ? r.div({}, 'Saving...')
      : r.div({},
          Button({ onClick: this.save }, 'Save'),
          Button({ onClick: this.props.closeEditor }, 'Cancel'),
          showAdvancedButton);

    return (
      r.div({ className: 'dw-p-ttl-e' },
        Input({ type: 'text', ref: 'titleInput', className: 'dw-i-title',
            defaultValue: titleText }),
        ReactCSSTransitionGroup({ transitionName: 'compl-stuff', transitionAppear: true },
          complicatedStuff),
        saveCancel));
  }
});


function getCurrentSlug() {
  // Only id, no slug?
  if (/\/-[a-zA-Z0-9_]+$/.test(location.pathname))
    return '';
  var matches = location.pathname.match(/\/[^/]*$/);
  if (!matches) {
    console.warn('Cannot find slug in path: ' + location.pathname + ' [DwE6KEF2]');
    return '';
  }
  var slashAndLastPathSegment = matches[0];
  var lastPathSegment = slashAndLastPathSegment.substr(1);
  return lastPathSegment;
}


function getCurrentUrlPathFolder() {
  // First find folder, if id (and perhaps slug) shown. Any id is always prefixed by '/-'.
  // E.g. '/some/folder/-pageid' or '/folder/-pageid/slug'.
  var matches = location.pathname.match(/^(.*\/)-[^/].*$/);
  if (matches)
    return matches[1];

  // If there's no id, but perhaps a slug, e.g. '/some/folder/' or '/folder/slug'.
  matches = location.pathname.match(/^(.*\/)[^/]*$/)
  if (matches)
    return matches[1];

  console.warn('Cannot find folder in path: ' + location.pathname + ' [DwE3KEF5]');
  return '/';
}


function isIdShownInUrl() {
  return /\/-[a-zA-Z0-9_]+/.test(location.pathname);
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
