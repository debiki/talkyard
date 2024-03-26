/*
 * Copyright (c) 2024 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />
/// <reference path="../morekit/proxy-diag.more.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const ExplainingListItem = util.ExplainingListItem;

interface BookmDiag {
  bookm: Tag
  tyype: TagType
  //tag?: Tag, bookmType?: TagType, anyValue?,
  me: Me, post: Post

  closeDiag
}

export function openBookmarkDropdown(atRect, ps: BookmDiag  // I18N bookmark menu
       ) {
  const imStaff = pat_isStaff(ps.me);

  //// Currently searching by id works too, because not all tag types have url slugs,
  //// and tag names might include spaces  [search_q_param_space]
  //// — so the server looks up by id (after first trying by slug).
  //const slugOrId = bookmType.urlSlug || bookmType.id;

  morekit.openProxyDiag({ atRect, flavor: DiagFlavor.Dropdown,
            dialogClassName: 'c_TagDrpdD' }, closeDiag => BookmDiag({ ...ps, closeDiag }));
}


interface State {
  bookm: Tag
  tyype?: TagType
  descr?: St
}

const BookmDiag = React.createFactory<BookmDiag>(function(ps: any) {
    const [tyype, setType] = React.useState<TagType | N>(null);
    const [bookm, setBookm] = React.useState<Tag>({
      id: No.TagId as TagId,
      tagTypeId: 0,  // later TagType.NoId  ?
      onPostId: ps.post.uniqueId,
    });
    const [descr, setDescr] = React.useState<St>('');
    const [prio, setPrio] = React.useState<Nr>(3);

    const bookmType = ps.bookmType || state?.tyype;

    const upsertTypeAddTag = () => {
      // [redux] modifying state in place  [edit] Hmm? Where?
      //const stateBef: TagsDiagState = this.state;
      const dispName: St =  "Bookm Type"; //this.refs.newTagInput.getValue();
      const newTagType: TagType = {
        // The server will generate an id.
        id: No.TagTypeId as TagTypeId,
        dispName,
        // urlSlug: window['debikiSlugify'](dispName),
        // Dropdown/checkbox to select what can be tagged? [missing_tags_feats]
        // But we can just look at if we've opened this dialog via a user or a post:
        canTagWhat: ThingType.Bookmark, // stateBef.forPat ? ThingType.Pats : ThingType.Posts,
        valueType: TypeValueType.Int32, // later:  TypeValueType.Task
        wantsValue: NeverAlways.Allowed,
      };
      Server.upsertType(newTagType, (tagTypeWitId: TagType) => {
        //if (this.isGone) return;
        //const stateAft: TagsDiagState = this.state;
        //const differentPat = stateBef.forPat?.id !== stateAft.forPat?.id;
        //const differentPost = stateBef.forPost?.uniqueId !== stateAft.forPost?.uniqueId;
        //if (differentPat || differentPost) return;
        // Add a tag with the new tag type:
        const newTag: Tag = {
          id: No.TagId as TagId,
          tagTypeId: tagTypeWitId.id,
          onPostId: ps.post.uniqueId,
        };
        setState({ bookm: newTag, tyype: newTagType });
      });
    }

    return rFr({},
    r.div({ className: 'esDropModal_header' },
        ps.bookmType ? "Edit bookmark" : "Add bookmark"),

    r.div({},
      r.div({},
        `Type: `, r.samp({ className: 'c_Tag' }, bookmType?.dispName)),
      bookmType ? null :
          Button({ onClick: upsertTypeAddTag }, "Create Test Bookmark"),

      "State: ", JSON.stringify(ps), r.br(),
      "ps: ", JSON.stringify(ps))
    /*
    r.ul({},
      ExplainingListItem({
          title: `View tag`,
          linkTo: UrlPaths.Tags + slugOrId,
          text: `Read about this tag`,
          tabIndex: 100,
          onNav: closeDiag,
          }),
      ExplainingListItem({
          title: rFr({}, `Search for tag`),
          linkTo: UrlPaths.SearchQ + `tags:${slugOrId}`,
          text: `List posts with this tag`,
          tabIndex: 100,
          onNav: closeDiag,
          }),
      !imStaff || !(tagType.wantsValue >= NeverAlways.Allowed) ? null : ExplainingListItem({
          title: isVal(ps.anyValue) ? `Edit tag value` : `Set tag value`,
          text: !isVal(ps.anyValue) ? null :
          // UX WOULD: For non-staff, maybe a "Copy value" + showing the value, could be nice?
          // Not important — it's visible in the tag list: "tag-name: value".
                    rFr({}, `Current value: `, r.samp({}, ps.anyValue)),
          tabIndex: 100,
          onSelect: () => {
            morekit.openProxyDiag({ atRect }, closeDiag => {
              return TagValEditor({
                  tag: ps.tag, tagType, closeParent: closeDiag });
            });
          } }),
      !imStaff ? null : ExplainingListItem({
          title: "Remove tag",
          text: null,
          tabIndex: 100,
          onSelect: () => {
            morekit.openProxyDiag({ atRect, closeOnButtonClick: true }, () => rFr({},
                r.p({}, "Remove tag?"),
                // UX BUG: Doesn't update forum topic list page, in all topic lists.
                // then, need to reload to see changes.  [edit_tags_via_topic_list]
                r.div({ className: 'c_DlgBtns' },
                    Button({}, "No, cancel"),
                    PrimaryButton({ onClick: () => {
                      // Will this upd the post? Depends! If rendered via the store, yes.
                      // Otherwise, not without page reload.  UX BUG, minor.
                      Server.updateTags({ remove: [ps.tag] });
                    }}, "Yes, delete"))));
          } }),
      )*/);
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------