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

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------


export function listenForLinkPreviewIframeSizeMessages() {
  addEventListener('message', onMessageFromChildIframe, false);
}


function onMessageFromChildIframe(event: WindowEventMap['message']) {
  // TESTS_MISSING  TyT037MKAH24

  //logT('onMessageFromChildIframe: ' + JSON.stringify(event.data));
  if (!_.isArray(event.data))
    return;

  const typeAndData = event.data;
  if (typeAndData[0] !== 'oEmbHeight')
    return;

  const maybeHeight: any = typeAndData[1];
  if (!_.isNumber(maybeHeight))
    return;

  let height: number = maybeHeight;
  logT(`oEmbed ifame height: ${height}  says frame: ${event.origin}`);

  // Not too small or too tall, what about:
  if (height < 30) height = 30;
  if (height > 770) height = 770;  // 770 + 10 + 15 = tall enough for Instagram,
                                   // but would be better to: [oemb_extr_height].

  const iframe = findIframeThatSent(event);
  if (iframe) {
    // Add 10 px to really avoid scrollbars. This Talkyard script: [OEMBHGHT] included
    // in the oEmbed <iframe srcdoc=...> sets any margins and paddings in the iframe
    // to 0, so maybe this + 10 isn't needed — but anyway:
    iframe.style.height = (height + 10 + 15) + 'px';   // [oemb_extr_height]
                    // And + 15  because crazy browsers  [iframe_height].
  }
  else {
    // The iframe just disappeared? Maybe an editor preview refreshed & changed,
    // or some React component got unmounted.
    logT(`No iframe found for message from: ` + event.origin);
  }
}


function findIframeThatSent(event): HTMLElement | U {  // Move to where?  [find_evt_ifrm]
  // (`iframes` is not an array.)
  const iframes: HTMLCollectionOf<HTMLElementTagNameMap['iframe']> =
          document.getElementsByTagName('iframe');
  for (let i = 0; i < iframes.length; ++i) {
    const iframe = iframes[i];
    if (iframe.contentWindow === event.source)
      return iframe;
  }
}



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
