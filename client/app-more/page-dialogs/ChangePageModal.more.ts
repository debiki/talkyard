/*
 * Copyright (c) 2014-2018 Kaj Magnus Lindberg
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
/// <reference path="../editor/PageRoleDropdown.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let changePageDialog;

export function openChangePageModal(atRect, props: { page: Page, showViewAnswerButton?: true }) {
  if (!changePageDialog) {
    changePageDialog = ReactDOM.render(ChangePageDialog(), utils.makeMountNode());
  }
  changePageDialog.openAtFor(atRect, props);
}


// some dupl code [6KUW24]
const ChangePageDialog = createComponent({
  displayName: 'ChangePageDialog',

  mixins: [StoreListenerMixin],

  getInitialState: function () {
    return {
      isOpen: false,
      store: debiki2.ReactStore.allData(),
    };
  },

  onChange: function() {
    this.setState({ store: debiki2.ReactStore.allData() });
  },

  // dupl code [6KUW24]
  openAtFor: function(rect, props: { page: Page, showViewAnswerButton?: boolean }) {
    this.setState({
      ...props,
      isOpen: true,
      atX: rect.left,
      atY: rect.bottom,
    });
  },

  close: function() {
    this.setState({
      isOpen: false,
      page: undefined,
      showViewAnswerButton: undefined,
    });
  },

  render: function() {
    const state = this.state;
    const store: Store = this.state.store;
    const settings: SettingsVisibleClientSide = store.settings;
    const me: Myself = store.me;
    const isOwnPage = store_thisIsMyPage(store);
    const isOwnOrStaff = isOwnPage || isStaff(me);

    let anyViewAnswerButton;
    let changeStatusTitle;
    let setNewListItem;
    let setPlannedListItem;
    let setStartedListItem;
    let setDoneListItem;
    let changeCategoryListItem;
    let changeTopicTypeListItem;
    let closeListItem;
    let reopenListItem;

    function savePage(changes: EditPageRequestData) {
      ReactActions.editTitleAndSettings(changes, null, null);
    }

    if (state.isOpen) {
      const page: Page = state.page;
      const canChangeDoingStatus = isOwnOrStaff &&
          page_hasDoingStatus(page) && !page_isClosedNotDone(page);
      const canChangeCategory = isOwnOrStaff && settings.showCategories !== false &&
          store.currentCategories.length;
      const canChangePageType = isOwnOrStaff && page_mayChangeRole(page.pageRole) &&
          settings_selectTopicType(settings, me);

      anyViewAnswerButton = !page.pageAnsweredAtMs || !state.showViewAnswerButton ? null :
          r.div({ className: 's_ExplDrp_ActIt' },
            Button({ className: 'e_VwAnsB',
                onClick: (event) => {
                  utils.makeShowPostFn(TitleNr, page.pageAnswerPostNr)(event);
                  this.close();
                }},
              "View answer"));  // I18N

      changeStatusTitle = !canChangeDoingStatus ? null :
          r.div({ className: 's_ExplDrp_Ttl' }, "Change status to:");  // I18N

      setNewListItem = !canChangeDoingStatus ? null :
          ExplainingListItem({
            active:  page.doingStatus === PageDoingStatus.Discussing,
            title: r.span({ className: 'e_PgSt-New'  }, "New"),  // I18N
            text: "New topic, under discussion",                // I18N
            onSelect: () => savePage({ doingStatus: PageDoingStatus.Discussing }) });

      setPlannedListItem = !canChangeDoingStatus ? null :
          ExplainingListItem({
            active: page.doingStatus === PageDoingStatus.Planned,
            title: r.span({ className: 'e_PgSt-Planned'  }, "Planned"), // I18N
            text: "We're planning to do this",              // I18N "do" —> fix/implement if probl/feat
            onSelect: () => savePage({ doingStatus: PageDoingStatus.Planned }) });

      setStartedListItem = !canChangeDoingStatus ? null :
          ExplainingListItem({
            active: page.doingStatus === PageDoingStatus.Started,
            title: r.span({ className: 'e_PgSt-Started'  }, "Started"), // I18N
            text: "We've started doing this",               // I18N "doing" —> fixing/implementing
            onSelect: () => savePage({ doingStatus: PageDoingStatus.Started }) });

      setDoneListItem = !canChangeDoingStatus ? null :
          ExplainingListItem({
            active: page.doingStatus === PageDoingStatus.Done,
            title: r.span({ className: 'e_PgSt-Done'  }, "Done"), // I18N
            text: "This has been done",                  // I18N "done" —> fixed/implemented
            onSelect: () => savePage({ doingStatus: PageDoingStatus.Done }) });

      changeCategoryListItem = !canChangeCategory ? null : rFragment({},
          r.div({ className: 's_ExplDrp_Ttl' }, "Change category:"),  // I18N
          r.div({ className: 's_ExplDrp_ActIt' },
            editor.SelectCategoryDropdown({
                store, selectedCategoryId: page.categoryId,
                onCategorySelected: (categoryId: CategoryId) => {
                  savePage({ categoryId });
                } })));

      changeTopicTypeListItem = !canChangePageType ? null : rFragment({},
          r.div({ className: 's_ExplDrp_Ttl' }, "Change topic type:"),  // I18N
          r.div({ className: 's_ExplDrp_ActIt' },
            editor.PageRoleDropdown({ pageRole: page.pageRole, pageExists: true, store,
                onSelect: (newType: PageRole) => {
                  savePage({ pageRole: newType });
                }})));

      // Show a Close button for unanswered questions and not-yet-done ideas/problems,
      // and a Reopen button if closed already.
      if (page.doingStatus === PageDoingStatus.Done || page.pageAnswerPostUniqueId) {
        // Page already done / has-an-accepted-answer; then, it's closed already. [5AKBS2]
      }
      else if (!page_canToggleClosed(page)) {
        // Cannot close or reopen this type of page.
      }
      else if (!isOwnOrStaff) {
        // May not close other people's pages.
      }
      else if (page.pageClosedAtMs) {
        reopenListItem = rFragment({},
            r.div({ className: 's_ExplDrp_Ttl' }, t.Reopen + '?'),
            r.div({ className: 's_ExplDrp_ActIt' },
              Button({ className: 'icon-circle-empty e_ReopenPgB',
                  onClick: debiki2.ReactActions.togglePageClosed },
                t.Reopen)));
      }
      else {
        let closeItemText: string;
        switch (page.pageRole) {
          case PageRole.Question:
            if (isOwnPage)
              closeItemText = t.pa.CloseOwnQuestionTooltip;
            else
              closeItemText = t.pa.CloseOthersQuestionTooltip;
            break;
          case PageRole.ToDo:
            closeItemText = t.pa.CloseToDoTooltip;
            break;
          default:
            closeItemText = t.pa.CloseTopicTooltip;
        }
        closeListItem = rFragment({},
            r.div({ className: 's_ExplDrp_Ttl' }, t.Close + '?'),
            r.div({ className: 's_ExplDrp_ActIt' },
              Button({ className: 'icon-block e_ClosePgB',
                  onClick: debiki2.ReactActions.togglePageClosed },
                t.Close),
              r.div({ className: 'esExplDrp_ActIt_Expl' }, closeItemText)));
      }
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: state.showViewAnswerButton, // (hack) then it's the icon to the left of the title
          showCloseButton: true, dialogClassName2: 's_ChPgD' },
        anyViewAnswerButton,
        changeStatusTitle,
        setNewListItem,
        setPlannedListItem,
        setStartedListItem,
        setDoneListItem,
        changeCategoryListItem,
        changeTopicTypeListItem,
        reopenListItem,
        closeListItem,
        ));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
