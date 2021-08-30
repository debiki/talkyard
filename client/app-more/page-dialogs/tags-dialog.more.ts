/*
 * Copyright (c) 2016, 2021 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../react-bootstrap-old/Input.more.ts" />
/// <reference path="../utils/PatternInput.more.ts" />
/// <reference path="../widgets.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const Modal = rb.Modal;
const ModalHeader = rb.ModalHeader;
const ModalTitle = rb.ModalTitle;
const ModalBody = rb.ModalBody;
const ModalFooter = rb.ModalFooter;
const PatternInput = utils.PatternInput;


let tagsDialog;

interface TagsDiagProps {
  // No props.
}

interface TagsDiagState {
  store?: Store;
  isOpen?: Bo;
  editorLoaded?: Bo;
  tagTypes?: TagType[],
  forPost?: Post;
  forPat?: Pat;
  curTags: Tag[],
  canAddTag?: Bo;
  onChanged?: () => Vo;
}


export function openTagsDialog(ps: TagDiagProps) {
  if (!tagsDialog) {
    tagsDialog = ReactDOM.render(TagsDialog(), utils.makeMountNode());
  }
  tagsDialog.open(ps);
}


const TagsDialog = createComponent({
  displayName: 'TagsDialog',

  getInitialState: function () {
    return {};
  },

  componentWillUnmount: function() {
    this.isGone = true;
  },

  open: function(ps: TagDiagProps) {
    dieIf(!!ps.forPat === !!ps.forPost, 'TyE602MWEG5');
    const newState: Partial<TagsDiagState> = {
      ...ps,  // was: store,
      curTags: _.clone(ps.forPost?.pubTags || ps.forPat?.pubTags || []),
    };
    this.setState(newState);

    const listWhatTagTypes = ps.forPost ? ThingType.Posts : ThingType.Pats;

    Server.listTagTypes(listWhatTagTypes, '', (tagTypes: TagType[]) => {
      const state: TagsDiagState = this.state;
      if (this.isGone) return;
      if (!state.curTags) return; // got closed
      // Sort the tags by name. More user friendly? Also, needed for the tags e2e tests
      // to be stable. [sort_tags]
      const tagTypesById = groupByKeepOne(tagTypes, (tt: TagType) => tt.id);
      const tagsSorted = [...state.curTags].sort(tags_mkSortFn(tagTypesById));
      const newState: Partial<TagsDiagState> = {
        tagTypes,
        curTags: tagsSorted,
      };
      this.setState(newState);
    });

    const curState: TagsDiagState = this.state;
    if (!curState.editorLoaded) Server.loadEditorAndMoreBundles(() => {
      if (this.isGone) return;
      const newState: Partial<TagsDiagState> = {
        editorLoaded: true,
      };
      this.setState(newState);
    });
  },

  close: function() {
    const newState: Partial<TagsDiagState> = {
            isOpen: false, store: null, forPost: null, forPat: null,
            curTags: null, tagTypes: null };
    this.setState(newState);
  },

  onSelectChange: function(labelsAndValues: { label: St, value: St }[]) {
    const state: TagsDiagState = this.state;
    labelsAndValues = labelsAndValues || []; // is null if the clear-all [x] button pressed
    const origTags = state.forPost?.pubTags || state.forPat?.pubTags;
    const newCurTags = [];
    for (const labVal of labelsAndValues) {
      const tagOrTagTypeId = parseInt(labVal.value);
      // Hack: < 0 means tag type id, negated. Won't be needed later, after having upgraded
      // to the newest version of React-Select?
      const isTagId = tagOrTagTypeId > 0;
      const tagId = isTagId && tagOrTagTypeId;
      const tagTypeId = !isTagId && -tagOrTagTypeId;  // undo negate_tagtype_id
      const origTag: Tag | U =
              _.find(origTags, t => t.id === tagId || t.tagTypeId === tagTypeId);

      let newTag: Tag | U;
      if (!origTag) {
        // @ifdef DEBUG
        dieIf(!tagTypeId, 'TyE2F0MW25')
        // @endif
        newTag = tagTypeId && {
          id: No.TagId as TagId,
          tagTypeId,
          onPostId: state.forPost?.uniqueId,
          onPatId: state.forPat?.id,
        };
      }

      const origOrNewTag = origTag || newTag;
      if (origOrNewTag) {
        newCurTags.push(origOrNewTag);
      }
    }
    const newState: Partial<TagsDiagState> = { curTags: newCurTags };
    this.setState(newState);
  },

  setCanAddTag: function(canAddTag: boolean) {
    this.setState({ canAddTag: canAddTag });
  },

  createTagTypeAddTag: function() {
    // [redux] modifying state in place
    const newTagType: TagType = {
      id: No.TagTypeId as TagTypeId,
      dispName: this.refs.newTagInput.getValue(),
      // Dropdown/checkbox to select what can be tagged? [missing_tags_feats]
      // For now: (badges more often requested than content tags)
      canTagWhat: ThingType.Pats,
    };
    const stateBef: TagsDiagState = this.state;
    Server.createTagType(newTagType, (tagTypeWitId: TagType) => {
      if (this.isGone) return;
      const stateAft: TagsDiagState = this.state;
      const differentPat = stateBef.forPat?.id !== stateAft.forPat?.id;
      const differentPost = stateBef.forPost?.uniqueId !== stateAft.forPost?.uniqueId;
      if (differentPat || differentPost) return;
      // Add a tag with the new tag type:
      const newTag: Tag = {
        id: No.TagId as TagId,
        tagTypeId: tagTypeWitId.id,
        onPatId: stateAft.forPat?.id,
        onPostId: stateAft.forPost?.uniqueId,
      };
      this.setState({
        curTags: [...stateAft.curTags, newTag],
        tagTypes: [...stateAft.tagTypes, tagTypeWitId],
      });
      //this.refs.newTagInput.clear(); [missing_tags_feats] should clear input here.
    });
  },

  save: function() {
    const state: TagsDiagState = this.state;
    // We know if a tag is new, because it then has no tag id.
    const tagsAdded: Tag[] = _.filter(state.curTags, t => t.id === No.TagId);
    const tagsBefore = state.forPost?.pubTags || state.forPat?.pubTags || [];
    const tagsRemoved: Tag[] = [];
    for (const tagBef of tagsBefore) {
      const tagNow = _.find(state.curTags, t => t.id === tagBef.id);
      if (!tagNow) {
        tagsRemoved.push(tagBef);
      }
    }
    Server.addRemoveTags({ add: tagsAdded, remove: tagsRemoved }, () => {
      // If this.state !== state, call the original state.onChanged — that's the
      // one related to the tags pat changed.
      if (state.onChanged) state.onChanged(); // not this.state
      if (this.isGone) return;
      this.close();
    });
  },

  render: function () {
    const state: TagsDiagState = this.state;
    let title: St | U;
    let content: RElm | U;
    let isForGroup: Bo | U;

    if (!state.curTags) {
      // Not open.
    }
    else if (!state.editorLoaded || !state.tagTypes) {
      content = r.p({}, t.Loading);
    }
    else {
      // I18N tags dialog, here and below.
      let what = "tag";
      let whatShort = what;
      let whatDash = what;
      if (state.forPost) {
        title = state.forPost.nr === BodyNr ? "Page tags" : "Post tags";
      }
      else if (state.forPat) {
        whatShort = "badge";
        what = "title badge";
        whatDash = "title-badge";
        title = (state.forPat.isGroup ? "Group Member" : '') + " Title Badges";
        isForGroup = state.forPat.isGroup;
      }
      else {
        die('TyE4GK0IF2');
      }

      const introText =
          state.forPost
            ? r.p({},
              "You can add tags to pages, to get another layer of structure, " +
              "in addition to categories.")
              // Skip, too wordy?:
              // "Each page can be in only one category, but can have many tags.")
            : r.p({},
              (state.forPat.isGroup ? "UNIMPLEMENTED for *groups*: " : '') +
              "These titles are shown next to " + (state.forPat.isGroup
                ? "names of members in this group, in posts they've writen."
                : "the person's name, in posts by him/her."));

      const tagListInput =
          Input({ type: 'custom', label: `Add existing ${whatShort}s:` },
            rb.ReactSelect({ multi: true, disabled: isForGroup, className: 'e_AdTg',
                value: makeTagLabelValues(state.curTags, state.tagTypes),
                placeholder: `Select ${what}s`,
                options: makeTagTypeLabelValues(state.tagTypes),
                onChange: this.onSelectChange }));

      const createNewTag =
          r.div({},
            PatternInput({ label: `Or create ${whatShort}:`, ref: 'newTagInput',
              placeholder: `${whatDash}-name`, className: 'e_CrTgI',
              disabled: isForGroup,
              onChangeValueOk: (value, ok) => this.setCanAddTag(ok),
              help: `Type a new ${what} name.`,
              // Bad chars, sync w Scala and database:  [ok_tag_chars]
              // ok chars, db:  '^[[:alnum:] ''!?&#%_.:=/^~+*-]*$';
              notRegexTwo: /["$(),;<>@[\]`{|}\\]/,
              // or this, but [:alnum:] is only ASCII – need \p{L}\p{N}\p{M}  /u for Unicode?
              //notRegexTwo: /[^[:alnum:] '!?&#%_.:=\/^~+*-]/,
              // or unicode: /[^\p{L}\p{N}\p{M} '!?&#%_.:=\/^~+*-]/u  ?
              notMessageTwo: `No weird chars like ",|[{(<" please`,
            }),
            Button({ onClick: this.createTagTypeAddTag, className: 'e_CrTgB',
                  disabled: isForGroup || !state.canAddTag },
              `Create ${what}`),
            r.span({ className: 'help-block' },
              "(Click ", r.b({}, "Save"), " too, to the right.)"));

      content =
        r.div({ className: 'esTsD_CreateTs' },
          introText,
          tagListInput,
          createNewTag);
    }

    return (
      Modal({ show: !!content, onHide: this.close, dialogClassName: 'esTsD' },
        ModalHeader({}, ModalTitle({}, title)),
        ModalBody({}, content),
        ModalFooter({},
          PrimaryButton({ onClick: this.save, disabled: isForGroup }, "Save"),
          Button({ onClick: this.close }, "Cancel"))));
  }
});


function makeTagLabelValues(tags: Tag[], tagTypes: TagType[]) {
  return tags.map((tag: Tag) => {
    const idOrTagTypeId = tag.id;
    // Hack, to play nice with ReactSelect: For new tags, the id is 0 (they don't yet
    // have any id), and they're instead identified by tag type, which
    // we store in { value }, negative to know it's not a tag id, but a tag type id.
    const value = tag.id || -tag.tagTypeId;  // negate_tagtype_id
    const tagType = _.find(tagTypes, tagType => tagType.id === tag.tagTypeId);
    return {
      label: tagType ? tagType.dispName : `tagTypeId=${tag.tagTypeId}`,
      value,
    };
  });
}


function makeTagTypeLabelValues(tagTypes: TagType[]) {
  return tagTypes.map((tagType: TagType) => {
    // Minus means it's a tag type id, not a tag id, so, in onSelectChange(), we know
    // the { label, value } refers to a newly added tag, with tag type = -value.
    return { label: tagType.dispName, value: -tagType.id };  // negate_tagtype_id
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
