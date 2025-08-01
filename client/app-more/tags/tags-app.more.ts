/*
 * Copyright (c) 2016–2023 Kaj Magnus Lindberg
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

//------------------------------------------------------------------------------
   namespace debiki2.tags {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;



export const TagsAppComponent = createReactClass(<any> {
  displayName:  'TagsAppComponent',
  mixins: [debiki2.StoreListenerMixin],

  getInitialState: function() {
    return {
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({
      store: debiki2.ReactStore.allData(),
    });
  },

  render: function() {
    const store: Store = this.state.store;
    return (
      r.div({ className: 'container c_TagsP' }, Switch({},
        // [React_Router_v51] skip render(), use hooks and useParams instead.
        Route({ path: UrlPaths.Tags, exact: true,
            render: () => AllTagsPanel({ store }) }),
        Route({ path: UrlPaths.Tags + ':typeIdOrSlug', exact: true,
            render: (routeProps: ReactRouterProps) =>
              OneTagPanel({ ...routeProps, store }) }),
        )));
  }
});


interface TagsPanelState {
  flashTagTypeId?: TagTypeId;
  doneLoading?: Bo;
}


const AllTagsPanel = createFactory({
  displayName:  'AllTagsPanel',

  getInitialState: function() {
    return {};
  },

  componentDidMount: function() {
    // Or maybe:
    // Server.listTagTypes({ forThings: ThingType.Pats + ThingType.Posts, inclStats: true });
    Server.loadEditorAndMoreBundles(() =>  // loads window.debikiSlugify [5FK2W08]
          Server.loadTagsAndStats(() => {
            this.setState({ doneLoading: true });
          }));
    // We might need to load cats too? E.g. if some tags can be used in only specific cats.

    // Later: (no longer works, tags just got reimplemented)
    //Server.loadMyTagNotfLevels();
  },

  render: function() {
    const state: TagsPanelState = this.state;
    const store: Store = this.props.store;
    const me: Myself = store.me;
    const imStaff = pat_isStaff(me);

    if (!state.doneLoading)
      return r.p({}, "Loading ...");

    const tagTypes: TagType[] = _.values(store.tagTypesById) || [];

    // Previously, could see how many had subscribed to a tag, but that's temporarily
    // disabled, after tags refactored (now, tag id, not label, is prim key).
    const myTagNotfLevels = [];
    // const subscribersColumn = isStaff(me) ? r.th({}, "Subscribers") : null;
    // const mutedColumn = isStaff(me) ? r.th({}, "Muted") : null;

    const tagTableRows = tagTypes.map(tagType =>
        TagTableRow({ store: store, tagType,
            myTagNotfLevels,
            flashTagTypeId: state.flashTagTypeId }));

    const onTagTypeCreated = (newTagType: TagType) => {
      // Currently the new-tag dialog jumps to the new tag instead, so one
      // can edit the slug or tag value type.
      // const newState = { flashTagTypeId: newTagType.id };
      // this.setState(newState);
    }

    let debugJson = null;
    // @ifdef DEBUG
    debugJson = rFr({},
        r.p({}, "Debug build JSON:"),
        r.pre({}, JSON.stringify(tagTypes, undefined, 4)));
    // @endif

    return (
      r.div({},
        !imStaff ? null : Button({ onClick: () => openCreateTagDialog(onTagTypeCreated) },
            "Create Tag"),
        r.h2({}, "Tags"), // [title_in_topbar]
        r.table({ className: "table c_TagT" },
          r.thead({},
            r.tr({},
              r.th({}, "Tag or Badge"),
              !store.tagTypeStatsById ? null : rFr({},
                  r.th({}, "Total usages"),
                  r.th({}, "Tagged posts"),
                  r.th({}, "User badges")),
              /*
              subscribersColumn,
              mutedColumn,
              r.th({}, "Notifications to you") */)),
          r.tbody({},
            tagTableRows)),
        debugJson));
  }
});



const noStats: TagTypeStats = {
  tagTypeId: No.TagTypeId as TagTypeId,
  numTotal: 0,
  numPostTags: 0,
  numPatBadges: 0,
}


function TagTableRow(props: { store: Store, tagType: TagType, myTagNotfLevels,
          flashTagTypeId?: TagTypeId }) {
    const store: Store = props.store;
    //var me: Myself = store.me;
    const tagType: TagType = props.tagType;
    const stats: TagTypeStats = store.tagTypeStatsById?.[tagType.id];
    //var myTagNotfLevels = props.myTagNotfLevels;
    //var tagNotfLevel = (myTagNotfLevels || {})[tagType.id] || PageNotfLevel.Normal;
    //var subscribersColumn = isStaff(me) ? r.td({}, tagAndStats.numSubscribers) : null;
    //var mutedColumn = isStaff(me) ? r.td({}, tagAndStats.numMuted) : null;
    const flashClass = props.flashTagTypeId === tagType.id ? 'n_Flash' : '';
    return (
      r.tr({ className: flashClass, key: tagType.id },
        r.td({},
          Tag({ tagType, me: store.me })),
        !stats ? null : rFr({},
            r.td({},
              stats.numTotal),
            r.td({},
              stats.numPostTags),
            r.td({},
              stats.numPatBadges)),
      ));
        /*
        subscribersColumn,
        mutedColumn,
        r.td({},
          "Unimplemented [2ABRP05F]")));
          /*notfs.PageNotfPrefButton({ pref, me: Myself }),
          notification.NotfLe  velButton_oldForTags({ subject: { tagLabel: tagAndStats.label },
              notfLevel: tagNotfLevel }))));
              */
}


interface OneTagPanelProps extends ReactRouterProps {
  store: Store;
}

type TagTypeEditing = TagType & { slugDash?: Bo };

const OneTagPanel = React.createFactory<OneTagPanelProps>(function(props) {
  const history: ReactRouterHistory = props.history;
  const location: ReactRouterLocation = props.location;
  const store: Store = props.store;
  const me: Me = store.me;
  const myId = React.useRef(me.id);
  const imStaff = pat_isStaff(me);
  const typeIdOrSlug: St = props.match.params.typeIdOrSlug;
  const typeRef = React.useRef(typeIdOrSlug);
  const [tagType, setTagType] = React.useState<TagType | N>(null);
  const [tagTypeEditedYes, setTagTypeEdited] = React.useState<TagTypeEditing | N>(null);
  const [savingText, setSavingText] = React.useState<St>('');
  const [postsNullOrFalse, setPosts] = usePostList();
  const [isEditing, setIsEditing] = React.useState<Bo>(false);

  // Maybe later. For now, always most recent first.
  //const anySortOrder = new URLSearchParams(props.location.search).get('sort');

  // Hide the changes, if pat clicks Edit and then Cancel. (Otherwise it'd look
  // as if the edits have been saved server side?)
  // No longer needed — [cancel_resets], instead.
  const tagTypeEdited: TagTypeEditing = isEditing ? tagTypeEditedYes : tagType;

  React.useEffect(() => {
    myId.current = me.id;
    typeRef.current = typeIdOrSlug;
    loadTagDescrAndTaggedPosts();
    return () => {
      myId.current = null;
      typeRef.current = null;
    }
  }, [me.id, typeIdOrSlug]);

  function loadTagDescrAndTaggedPosts() {
    // This also inserts the tag type into the store, ...
    Server.loadPostsWithTag({ typeIdOrSlug }, // orderBy: anySortOrder
              (tagTypeId, posts: PostWithPage[]) => {
      if (myId.current !== me.id || typeRef.current !== typeIdOrSlug) return;
      // ... so we can copy it and remember any changes.
      const tagType: TagType = store.tagTypesById[tagTypeId];
      setTagType(tagType);
      setTagTypeEdited({ ...tagType });
      setPosts(posts);
      // More nice with tag slug in the URL, instead of the id.
      updateUrlSlug(tagType);
    });
  }

  function saveChangesToType() {
    setSavingText(t.SavingDots);
    Server.upsertType(tagTypeEdited, (type: TagType) => {
      // @ifdef DEBUG
      console.debug(`upsertType done: ${JSON.stringify(type)}`);
      // @endif
      setSavingText(t.SavedDot);
      setTagType(tagTypeEdited);
      updateUrlSlug(tagTypeEdited);
    },
      () => setSavingText('Error.'), // on error
    );
  }

  function updateUrlSlug(tagType: TagType) {
    if (tagType.urlSlug && typeIdOrSlug !== tagType.urlSlug) {
      history.replace(UrlPaths.Tags + tagType.urlSlug + location.search + location.hash);
    }
  }

  // Bit dupl code, see the posts-with-tag list. [dupl_list_posts]
  if (postsNullOrFalse === null)
    return t.Loading;

  if (!postsNullOrFalse)
    return r.p({ className: 's_TagsP_Dnd' },
        "Access denied"); // I18N, see: t.gpp.MayNotListMembers

  const posts: PostWithPage[] = postsNullOrFalse;

  const typeEdited = !_.isEqual(tagType, tagTypeEdited);

  let devBuildDebugInfo = null;
  // @ifdef DEBUG
  console.debug(`tagType: ${JSON.stringify(tagType)}`);
  console.debug(`tagTypeEdited: ${JSON.stringify(tagTypeEdited)}`);
  devBuildDebugInfo =
      rFr({},
        r.h3({}, "Debug:"),
        r.pre({}, JSON.stringify(posts, undefined, 2)));
  // @endif

  // For choosing tag value type (if any). But if we're not editing the tag, then,
  // no radio buttons are shown; instead, there's just a <span> showing any
  // currently selected value type.
  function mkRadioBtn(valueType: TypeValueType | N, className, label, help, ps?) {
    if (!isEditing) {
      if (tagTypeEdited.valueType !== valueType) return null;
      return r.span({ className: 'c_Tag_ValTyp_CanAns' }, label);
    }
    function onChange() {
      const wantsValue = valueType === null ?
              NeverAlways.NeverButCanContinue : NeverAlways.AlwaysButCanContinue;
      setTagTypeEdited({ ...tagTypeEdited, wantsValue, valueType });
    }
    return Input({ type: 'radio', className, label, help, ...(ps || {}),
            checked: tagTypeEdited.valueType === valueType,
            onChange });
  }

  const tagSlugSearchQ = `tags:${tagType.urlSlug || tagType.id}`; // [search_q_param_space]
  const tagSlugSearchUrl = UrlPaths.SearchQ + tagSlugSearchQ;

  return rFr({},
      // UX: Would be nice with this title in the topbar? so it's visible also if
      // one scrolls down.  Maybe add a topbarTitle to the store?  [title_in_topbar]
      r.h1({}, "About tag: ",   // I18N this whole page
        r.span({ className: 'c_Tag' },
          r.span({ className: 'c_Tag_Name' },
            tagType.dispName))),

      r.form({ className: `c_Tag_EdF c_Tag_EdF-${isEditing ? 'IsEd' : '0Ed'}` },
        !isEditing ? null :
            Input({ className: '', label: "Name",
                help: `You can rename tags.`,
                value: tagTypeEdited.dispName,
                onChange: (event) => {
                  setTagTypeEdited({ ...tagTypeEdited, dispName: event.target.value })
                } }),

        !isEditing
          ? r.p({ className: 'c_Tag_UrlSlug' },
                "URL slug: ", !tagType.urlSlug ? "(None)" : r.kbd({}, tagType.urlSlug))
          : Input({ className: '', label: "URL slug",
                pattern: '[a-z0-9\\-]', // for now
                help: rFr({},
                    `A lowercase-and-dashes name. Appears in the URL, and ` +
                    `you can use in search queries — search for `,
                    r.code({},
                      TyLink({ to: tagSlugSearchUrl }, tagSlugSearchQ))),
                value: tagTypeEdited.urlSlug || '',
                onChange: (event) => {
                  // While typing, _ending_with_dash '-' is fine.  Then, don't slugify.
                  // (Otherwise, slugify() would remove the '-', would be impossible to type.)
                  let slug = event.target.value;
                  const lastChar: St | U = slug[slug.length - 1];
                  const slugDash = lastChar === '-';
                  if (!slugDash) {
                    // This makes the input a bit funny: If you type any not-allowed char,
                    // e.g. '#', it never appears, instead, the cursor jumps to the end.
                    // UX COULD instead show an info text?:
                    //     "Only letters, digits and dashes please, not: '#'"
                    slug = window['debikiSlugify'](slug);
                  }
                  setTagTypeEdited({ ...tagTypeEdited, urlSlug: slug, slugDash })
                } }),

        r.div({ className: 'c_Tag_ValTyp' },
        r.span({ className: 'c_Tag_ValTyp_CanQ' }, "Can this tag have values? "),
            mkRadioBtn(  // I18N, the labels (visible to everyone)
                null, 'e_NoVal',
                "No (the default)",
                "It's just a normal tag."),
            mkRadioBtn(
                TypeValueType.Int32, 'e_Int32',
                "Yes, integer numbers",
                "Can have values like 1234."),
            mkRadioBtn(
                TypeValueType.Flt64, 'e_Flt64',
                "Yes, decimal numbers",
                "Can have values like 12.345"),
            mkRadioBtn(
                TypeValueType.StrKwd, 'e_StrKwd',
                "Yes, words",
                "Can have values like: 'Kitten', 'Dog', 'Elephant seal'."),
            /*
            mkRadioBtn(
                null, '',
                "Yes, text",
                `Not just a word, but longer text. For example: ` +
                      `"Kittens are cute, and kind: They want milk, don't eat birds".`,
                { disabled: true }),
            mkRadioBtn(
                null, '',
                "Yes, dates",
                "Can be a date, e.g. 2024-12-31 23:59.",
                { disabled: true }),
            mkRadioBtn(
                null, '',
                "Yes, date ranges",
                "A start and end date, e.g. 2024-02-03 18:00 — 2024-02-04 10:00:00",
                { disabled: true }),
            mkRadioBtn(
                null, '',
                "Yes, locations",
                "Latitude and longitude numbers",
                { disabled: true }), */
            ),

        !imStaff ? null : rFr({},
            // If editing, show a Reference ID input, but if not ...
            (!isEditing ? null : Input({ className: '', label: "Reference ID",
                help: rFr({},
                  `In API request, you can reference this tag type by typing "rid:" ` +
                  `and then the reference id. Like so: `,
                  r.code({}, `rid:${tagTypeEdited.refId || "sample_id"}`),
                  ` — You can also use the URL slug: `,
                  r.code({}, `slug:${tagTypeEdited.urlSlug || "sample-url-slug"}`),
                  ` but then, if you change the URL slug, all your API clients could break?`),
                value: tagTypeEdited.refId || '',
                onChange: (event) => {
                  setTagTypeEdited({ ...tagTypeEdited, refId: event.target.value })
                } })),
            // ... if not editing, instead show a <p> with the reference id, and ...
            r.p({ className: 'c_Tag_Ids' },
                isEditing ? null : r.span({ className: 'c_Tag_Ids_Rid' },
                  "Reference id: ",  !tagType.refId  ?  r.i({},' None')  :
                      r.code({}, tagType.refId),  r.br()),
                // ... always show the internal id — it cannot be changed.
                r.span({ className: 'c_Tag_Ids_Id' },
                  "Internal id: ", r.code({}, tagType.id)))),
        !pat_isStaff(me) ? null : r.div({ className: 'c_Tag_EdBtns' },
            isEditing
              ? Button({ onClick: () => {
                  setIsEditing(false);
                  // I think it's safer to forget any edits in progress? People might
                  // otherwise not realize that some of their test edits reappear, if
                  // clicking Edit again, after previously having hit Edit, edited, & Cancel.
                  // UX [cancel_resets] WOULD search for Cancel in all of Ty and
                  // make sure cancel forgets any edits-in-progress?
                  setTagTypeEdited({ ...tagType });
                } }, "Cancel")
              : Button({ onClick: () => setIsEditing(true) }, "Edit"),
            // Can't save if slug ends with '-'. [_ending_with_dash]
            !isEditing || !typeEdited || tagTypeEdited.slugDash ? null :
                PrimaryButton({ onClick: saveChangesToType }, "Save changes"),
            !savingText ? null :
                r.span({ className: 'c_SavInf' }, savingText)),
        ),

      r.p({ className: 'c_Tag_SchLn' },
        TyLink({ to: tagSlugSearchUrl, }, "Search for tag"), " (list posts with this tag)"),

      r.h2({}, "Recent posts with this tag:"),  // I18N
      !posts.length
          ? r.p({}, r.i({}, "None."))
          : users.PostList({ store, posts }),
      devBuildDebugInfo);
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
