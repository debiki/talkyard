/*
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

/// <reference path="prelude.ts" />
/// <reference path="utils/utils.ts" />
/// <reference path="store-getters.ts" />


//------------------------------------------------------------------------------
   namespace debiki2.BrowserStorage {
//------------------------------------------------------------------------------

let theStorage: Storage | U;
let whichStorage: WhichStorage | U;
let tempObjStorage: Ay | U;


// Who knows which storage the browser lets us use?
// Try first with localStorage — that's more user friendly?
//
// Because with sessionStorage is not so obvious what it does when many
// browser tabs are open — some tabs share the same sessionStorage, other
// tabs have their own. Makes me confused.
//
function withBrowserStorage(fn: (storage: Storage, whichStorage: WhichStorage) => Vo) {
  function doesItWork(storage: Storage): boolean {
    const testKey = 'tytest';
    const testValue = 'true';
    let valueRead;
    storage.setItem(testKey, testValue);
    valueRead = storage.getItem(testKey);
    storage.removeItem(testKey);
    return valueRead === testValue;
  }

  if (!theStorage) {
    // Just *looking* at localStorage can throw an "Access is denied" error,
    // so need to use try-catch.
    let localStorageWorks;
    try { localStorageWorks = doesItWork(localStorage); }
    catch (ex) {}

    if (localStorageWorks) {
      theStorage = localStorage;
      whichStorage = WhichStorage.LocalStorage;
    }
    else {
      let sessionStorageWorks;
      try { sessionStorageWorks = doesItWork(sessionStorage); }
      catch (ex) {}

      if (sessionStorageWorks) {
        theStorage = sessionStorage;
        whichStorage = WhichStorage.SessionStorage;
      }
      else {
        // Dupl code [OBJSTRG].  UNTESTED?
        tempObjStorage = {};
        const pageVarStorage: Storage = {
          key: function(index: number): string | null {
            return Object.keys(tempObjStorage)[index];
          },
          getItem: function(key: string): string | null {
            return tempObjStorage[key];
          },
          setItem: function(key: string, value: string) {
            tempObjStorage[key] = value;
          },
          removeItem: function(key: string) {
            delete tempObjStorage[key];
          },
        } as Storage;
        theStorage = pageVarStorage;
        whichStorage = WhichStorage.PageVar;
      }
    }
  }

  // Wrap in try-catch in case browser privacy settings now later on
  // suddenly prevent access.
  try {
    fn(theStorage, whichStorage);
  }
  catch (ex) {
    logAndDebugDie(`Error doing sth w browser storage [TyEBRWSTR]`, ex);
  }
}


export function get(key: St): Ay | U {
  const keyStr = stableStringifySkipNulls(key, true);
  let valueStr: St | Nu | U;
  withBrowserStorage(s => valueStr = s.getItem(keyStr));
  let value: Ay | U;
  if (valueStr) {
    try {
      value = JSON.parse(valueStr);
    }
    catch (ex) {
      // This is "impossible". Someone placed sth weird in the storage?
      // Talkyard doesn't have any code that can do that?
      // Maybe delete this storage key-value?
      // @ifdef DEBUG
      logAndDebugDie(`Error parsing browser storage value for key '${key}' [TyESTRREAD]`, ex);
      // @endif
      void 0; // [macro-bug]
    }
  }
  return value;
}


/// Returns true iff the key-val could be stored in a storage that lasts across
/// page reload. False means the storage is a temp js var, lost on reload.
///
export function set(key: St, value: Ay): Bo {
  const valueStr = JSON.stringify(value);
  const keyStr = stableStringifySkipNulls(key, true);
  let whichStorage: WhichStorage | U;
  withBrowserStorage(function(s, w) {
    s.setItem(keyStr, valueStr);
    whichStorage = w;
  });
  return whichStorage !== WhichStorage.PageVar;
}


export function remove(key: St): Vo {
  const keyStr = stableStringifySkipNulls(key, true);
  withBrowserStorage(s => s.removeItem(keyStr));
}


export function forEachDraft(pageId: PageId, fn: (draft: Draft, keyStr: St) => Vo) {
  withBrowserStorage(function(storage: Storage) {
    for (let i = 0; true; i++) {
      const keyStr = storage.key(i);

      // Looped past the last item?
      if (!keyStr)
        break;

      // Is this a draft?
      if (keyStr.indexOf('draftType') === -1)
        continue;

      // Is this draft for the current page?
      const locator: DraftLocator = JSON.parse(keyStr);
      if (locator.embeddingUrl !== eds.embeddingUrl && locator.pageId !== pageId)
        continue;

      // Get the draft.
      const draftStr = storage.getItem(keyStr);
      let draft: Draft;
      let bad;
      try {
        draft = JSON.parse(draftStr);
      }
      catch (ex) {
        bad = true;
      }

      if (bad || !draft.forWhat) {
        // Weird. Using this broken draft cuold cause undefined object access bugs.
        storage.removeItem(keyStr);
        continue;
      }

      fn(draft, keyStr);
    };
  });
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
