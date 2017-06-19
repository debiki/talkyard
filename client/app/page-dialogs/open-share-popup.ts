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

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------


export const Facebook = 'facebook';
export const Twitter = 'twitter';
export const Google = 'google';
export const Email = 'mail';


/**
 * Placed in slim-bundle.ts, so is available instantly. If dynamically loaded in more-bundle,
 * the browser will refuse to open the popup, because there would be some delay between the
 * share link click, ...downloading more-bundle... and opening the popup from code in more-bundle.
 */
export function openSharePopup(url: string, where: string) {
  const encodedUrl = encodeURIComponent(url);
  let urlToOpen;
  let windowSize;
  // These FB, Twitter, Google share links works as of May 29, 2016. And June 18, 2017.
  switch (where) {
    case Facebook:
      // There's also: &t=<title>
      urlToOpen = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
      windowSize = "width=600,height=400";
      break;
    case Twitter:
      // There's also: &via=<twitter-handle>&text=<title>
      urlToOpen = 'https://www.twitter.com/intent/tweet?url=' + encodedUrl;
      windowSize = "width=600,height=500";
      break;
    case Google:
      urlToOpen = 'https://plus.google.com/share?url=' + encodedUrl;
      windowSize = "width=550,height=550";
      break;
    case Email:
      window.open('mailto:?body=' +  encodedUrl);
      return;
    default:
      die('EdE6YKF32');
  }
  window.open(urlToOpen, '',
      'resizable=yes,scrollbars=yes,location=yes,menubar=no,toolbar=no,status=no,' + windowSize);
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
