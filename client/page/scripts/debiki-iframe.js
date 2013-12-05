/* Makes Debiki's <iframe> behave like seamless=seamless iframes.
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

var d = { i: debiki.internal, u: debiki.v0.util };
var $ = d.i.$;


if (!window.parent)
  return;


addEventListener('message', onMessage, false);

window.parent.postMessage(['iframeInited', ''], '*');

setTimeout(function() {
window.parent.postMessage(['setIframeSize', {
  width: $(document).width() + 100,
  height: $(document).height() + 100
}], '*');
}, 3000);


function onMessage(envent) {
  var eventName = event.data[0];
  var eventData = event.data[1];

  switch (eventName) {
    case 'setBaseAddress':
      addBaseElem(eventData);
      break;
  }
};


function addBaseElem(address) {
  var baseElem = $('<base href="' + address + '" target="_parent">');
  $('head').append(baseElem);
};


// vim: fdm=marker et ts=2 sw=2 list
