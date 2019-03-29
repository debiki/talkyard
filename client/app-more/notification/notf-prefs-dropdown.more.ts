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

//------------------------------------------------------------------------------
   namespace debiki2.notfs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;


let notfsLevelDropdownModal;

export function openNotfPrefDropdown(atRect, props: {
      target: PageNotfPrefTarget, ownPrefs: OwnPageNotfPrefs, saveFn?: (newLevel: PageNotfLevel) => void }) {
  if (!notfsLevelDropdownModal) {
    notfsLevelDropdownModal = ReactDOM.render(NotfsLevelDropdownModal(), utils.makeMountNode());
  }
  notfsLevelDropdownModal.openAtFor(atRect, props);
}


// some dupl code [6KUW24]
const NotfsLevelDropdownModal = createComponent({
  displayName: 'NotfsLevelDropdownModal',

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
  openAtFor: function(rect, props: {
      target: PageNotfPrefTarget, ownPrefs: OwnPageNotfPrefs, saveFn?: (newLevel: PageNotfLevel) => void }) {
    this.setState({
      isOpen: true,
      atX: rect.left,
      atY: rect.bottom,
      target: props.target,
      ownPrefs: props.ownPrefs,
      saveFn: props.saveFn,
    });
  },

  close: function() {
    this.setState({
      isOpen: false,
      target: undefined,
      ownPrefs: undefined,
      saveFn: undefined,
    });
  },

  saveNotfLevel: function(notfLevel) {
    if (this.state.saveFn) {
      this.state.saveFn(notfLevel);
    }
    else {
      const ownPrefs: OwnPageNotfPrefs = this.state.ownPrefs;
      const target: PageNotfPrefTarget = this.state.target;
      Server.savePageNotfPrefUpdStore(ownPrefs.id, target, notfLevel);
    }
    this.close();
  },

  render: function() {
    const state = this.state;
    const store: Store = this.state.store;
    let everyPostListItem;
    let newTopicsListItem;
    let normalListItem;
    let hushedListItem;
    let mutedListItem;

    if (state.isOpen) {
      const target: PageNotfPrefTarget = this.state.target;
      const ownPrefs: OwnPageNotfPrefs = this.state.ownPrefs;
      const effPref: EffPageNotfPref = pageNotfPrefTarget_findEffPref(target, store, ownPrefs);
      const inheritedLevel = effPref.inheritedNotfPref && effPref.inheritedNotfPref.notfLevel;
      const effLevel: PageNotfLevel = effPref.notfLevel || inheritedLevel;
      const isForPage = !!target.pageId;

      // @ifdef DEBUG
      console.log("Debug:\n" + JSON.stringify(effPref));
      // @endif

      const makeListItem = (itemsLevel, title, e2eClass) =>
          ExplainingListItem({
            active: effLevel === itemsLevel,
            title: r.span({ className: e2eClass  }, title),
            text: notfLevel_descr(itemsLevel, effPref, store),
            onSelect: () => this.saveNotfLevel(itemsLevel) });

      everyPostListItem = makeListItem(PageNotfLevel.EveryPost, t.nl.EveryPost, 'e_NtfAll');
      newTopicsListItem = isForPage ? null :
          makeListItem(PageNotfLevel.NewTopics, t.nl.NewTopics, 'e_NtfFst');
      hushedListItem = makeListItem(PageNotfLevel.Hushed, t.nl.Hushed, 'e_NtfHsh');
      mutedListItem = makeListItem(PageNotfLevel.Muted, t.nl.Muted, 'e_NtfMtd');

      // Show PageNotfLevel.NewTopics as Normal, when on a topic that exists already. [4WKBG0268]
      normalListItem =
          ExplainingListItem({
            active: effLevel === PageNotfLevel.Normal || (
                isForPage && effLevel === PageNotfLevel.NewTopics),
            title: r.span({ className: 'e_NtfNml'  }, t.nl.Normal),
            text: notfLevel_descr(PageNotfLevel.Normal, effPref, store),
            onSelect: () => this.saveNotfLevel(PageNotfLevel.Normal) });
    }

    return (
      DropdownModal({ show: state.isOpen, onHide: this.close, atX: state.atX, atY: state.atY,
          pullLeft: true, showCloseButton: true },
        r.div({ className: 's_NotfPrefDD_Ttl' }, t.GetNotifiedAbout + ':'),
        everyPostListItem,
        newTopicsListItem,
        normalListItem,
        hushedListItem,
        mutedListItem));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
