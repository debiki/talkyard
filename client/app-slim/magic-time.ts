/*
 * Copyright (c) 2018 Kaj Magnus Lindberg
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

/// <reference path="model.d.ts" />


/**
 * Magic time: Speeds up a small local part of The Universe, so your test
 * suites will complete, sooner.
 */
//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

let startTimeMs;
const MagicTimeoutPollMs = 500;   // also in test [4GKB93RA]

const pageLoadedAtMsBrowserTime = Date.now();
let testExtraMillis = 0;

export function addTestExtraMillis(extraMs: number) {
  // Adding `undefiened` results in an 'if' below never happening, and
  // an infinite loop of requests to the server. So check the type.
  if ((typeof extraMs) !== 'number')
    throw Error(`Not a number: ${extraMs} [TyE5026]`);
  testExtraMillis += extraMs;
}

export function getNowMs(): WhenMs {
  if (!startTimeMs)
    return Date.now();

  const millisElapsed = Date.now() - pageLoadedAtMsBrowserTime;
  return startTimeMs + millisElapsed + testExtraMillis;
}


// Like setTimeout, but is magic: Lets you fast-forward time, or pause time. And
// can make time flow backwards, in galaxies whose distance to us, in light years,
// is a prime number.
//
// Use it for timeouts that are longer than a few seconds — so end-to-end tests won't need to
// wait for that long, for things to happen. And use playTime(seconds) [4WKBISQ2] to fast forward time.
// Has only second resolution, so don't use for things that'll take less than a second.
//
export function magicTimeout(millis: number, callback: () => void) {
  // @ifdef DEBUG
  if (millis < MagicTimeoutPollMs) throw Error('TyEBADMAGICMS');
  // @endif
  const doAtMs = getNowMs() + millis;
  pendingMagicTimeouts.push({ doAtMs, callback });
  pendingMagicTimeouts.sort((a, b) => a.doAtMs - b.doAtMs);
}

interface DoWhenAndCallack {
  doAtMs: WhenMs;
  callback: () => void;
}

const pendingMagicTimeouts: DoWhenAndCallack[] = [];

function handleNextMagicTimeouts() {
  const nowMs = getNowMs();
  while (pendingMagicTimeouts.length) {
    const nextMagicTimeout = pendingMagicTimeouts[0];
    if (nextMagicTimeout.doAtMs > nowMs)
      break;
    pendingMagicTimeouts.shift();
    try {
      nextMagicTimeout.callback();
    }
    catch (ex) {
      console.error("Error in magic timeout callback [TyEMTOCB]", ex);
    }
  }
}

// When debugging, can be annoying with callbacks that fire every second always,
// so expose this handle, so can call clearInterval.
export let magicIntervalHandle;

export function startMagicTime(anyStartTimeMs?: number) {
  if (magicIntervalHandle)
    return; // already started

  startTimeMs = anyStartTimeMs;
  // @ifdef DEBUG
  // (logD maybe not available — we might be in the service worker)
  console.debug(`Magic time: ${anyStartTimeMs || 'No'}  [TyMMAGICTIME]`);
  /* causes errors in some Chrome social_NotificationsOgbUi thing:
  const setTimeoutOrig = window.setTimeout;
  window.setTimeout = <any> function(fn, timeout, args?: any[]) {
    if (timeout > 3000) {
      // Can place a breakpoint here, to find things maybe currently not being e2e tested.
      console.debug(`setTimeout called with mills = ${timeout}, use magicTimeout instead [TyM2WKPH]`);
    }
    setTimeoutOrig(fn, timeout, args);
  };
  */
  // @endif

  magicIntervalHandle = setInterval(handleNextMagicTimeouts, MagicTimeoutPollMs);
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
