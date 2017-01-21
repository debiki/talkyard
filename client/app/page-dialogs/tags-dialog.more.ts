/*
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
/// <reference path="../utils/PatternInput.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

var r = React.DOM;
var Modal = rb.Modal;
var ModalHeader = rb.ModalHeader;
var ModalTitle = rb.ModalTitle;
var ModalBody = rb.ModalBody;
var ModalFooter = rb.ModalFooter;
var PatternInput = utils.PatternInput;


var tagsDialog;


export function openTagsDialog(store: Store, post: Post) {
  if (!tagsDialog) {
    tagsDialog = ReactDOM.render(TagsDialog(), utils.makeMountNode());
  }
  tagsDialog.open(store, post);
}


var TagsDialog = createComponent({
  displayName: 'TagsDialog',

  getInitialState: function () {
    return {
      isOpen: false,
      tags: [],
      allTags: [],
    };
  },

  componentWillMount: function() {
    this.isUnmounted = false;
  },

  componentWillUnmount: function() {
    this.isUnmounted = true;
  },

  open: function(store, post: Post) {
    this.setState({ isOpen: true, isLoading: true });
    Server.loadAllTags((tags) => {
      if (this.isUnmounted) return;
      this.setState({ allTags: tags });
    });
    Server.loadEditorAndMoreBundles(() => {
      if (this.isUnmounted || !this.state.isOpen) return;
      this.setState({
        isLoading: false,
        store: store,
        post: post,
        tags: _.clone(post.tags),
      });
    });
  },

  close: function() {
    this.setState({ isOpen: false, store: null, post: null, tags: null });
  },

  onSelectChange: function(labelsAndValues: any) {
    labelsAndValues = labelsAndValues || []; // is null if the clear-all [x] button pressed
    this.setState({ tags: labelsAndValues.map(labelValue => labelValue.value) });
  },

  setCanAddTag: function(canAddTag: boolean) {
    this.setState({ canAddTag: canAddTag });
  },

  createAndAddTag: function() {
    // [redux] modifying state in place
    var tags = this.state.tags;
    var newTag = this.refs.newTagInput.getValue();
    tags.push(newTag);
    tags = _.uniq(tags);
    this.setState({ tags: tags });
  },

  save: function() {
    Server.addRemovePostTags(this.state.post.uniqueId, this.state.tags, () => {
      if (this.isUnmounted) return;
      this.close();
    });
  },

  render: function () {
    var state = this.state;
    var post: Post = state.post;
    var title;
    var content;

    if (this.state.isLoading)
      return r.p({}, "Loading...");

    if (!this.state.isOpen) {
      // Nothing.
    }
    else {
      dieIf(!post, 'EsE4GK0IF2');
      title = post.nr === BodyNr ? "Page tags" : "Post tags";
      content =
        r.div({ className: 'esTsD_CreateTs' },
          rb.ReactSelect({ multi: true, value: makeLabelValues(this.state.tags),
            className: 'esTsD_TsS', placeholder: "Select tags",
            options: makeLabelValues(this.state.allTags), onChange: this.onSelectChange }),
          r.div({},
            PatternInput({ label: "Create tag:", ref: 'newTagInput', placeholder: "tag-name",
              onChangeValueOk: (value, ok) => this.setCanAddTag(ok),
              help: "Type a new tag name.",
              notRegex: /\s/, notMessage: "No spaces",
              notRegexTwo: /[,;\|\?!\*'"]/, notMessageTwo: "No weird chars like ',;?*' please",
            }),
            Button({ onClick: this.createAndAddTag, disabled: !this.state.canAddTag },
              "Create and add tag")));
    }

    return (
      Modal({ show: this.state.isOpen, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, title)),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.save }, "Save"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


function makeLabelValues(tags: string[]) {
  return tags.map(tag => {
    return { label: tag, value: tag };
  });
}

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
