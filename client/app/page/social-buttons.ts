/*
 * Copyright (c) 2017 Kaj Magnus Lindberg
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

/// <reference path="../prelude.ts" />
/// <reference path="../Server.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.page {
//------------------------------------------------------------------------------

export function SocialButtons(props?) {
  const aAnyAttrs: any = r.a;
  const divAnyAttrs: any = r.div;
  return (
    r.div({ className: 's_LikeBs' },
      aAnyAttrs({ href: 'https://twitter.com/share', className: 'twitter-share-button',
          'data-show-count': false }, "Tweet"),
      r.div({ className: 'google-plus' }, divAnyAttrs({ className: 'g-plusone', 'data-size': 'medium' })),
      divAnyAttrs({ className: 'fb-like', 'data-layout': 'standard', 'data-action': 'like',
          'data-size': 'small', 'data-show-faces': 'true', 'data-share': 'true',
          'data-width': 300 }))); // otherwise too wide, causes the PostAction buttons to float drop
}

/* You can copy-paste this and insert in custom html pages: (update the Facebook
   data-href to point to your Facebook organization page, or delete that data-href)

  <a href="https://twitter.com/share" class="twitter-share-button" data-show-count="true">Tweet</a>
  <div class="google-plus"><div class="g-plusone" data-size="medium"></div></div>
  <div class="fb-like" data-href=... data-layout="standard" data-action="like"
      data-size="small" data-show-faces="true" data-share="true"></div>

Or, large buttons, against a dark background:

  <a href="https://twitter.com/share" class="twitter-share-button" data-show-count="true" data-size="large">Tweet</a>
  <div class="google-plus"><div class="g-plusone" data-size="standard"></div></div>
  <div class="fb-like" data-href=... data-layout="standard" data-action="like"
      data-size="large" data-show-faces="true" data-share="true" data-colorscheme="dark"></div>

 */


export function activateLikeButtons(settings: SettingsVisibleClientSide) {
  if ($first('.fb-like')) {
    runFacebookJs(settings.facebookAppId);
  }
  if ($first('.twitter-share-button')) {
    runTwitterJs();
  }
  // Google:
  if ($first('.g-plusone')) {
    Server.loadJs('https://apis.google.com/js/platform.js');
  }
}


function runFacebookJs(appId: string) {
  const appIdParam = appId ? '&appId=' + appId : '';
  (function (d, s, id) {
    let js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s);
    js.id = id;
    js.src = '//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.10' + appIdParam;
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
}


function runTwitterJs() {
  window['twttr'] = (function(d, s, id) {
    let js, fjs = d.getElementsByTagName(s)[0],
      t = window['twttr'] || {};
    if (d.getElementById(id)) return t;
    js = d.createElement(s);
    js.id = id;
    js.src = 'https://platform.twitter.com/widgets.js';
    fjs.parentNode.insertBefore(js, fjs);

    t._e = [];
    t.ready = function(f) {
      t._e.push(f);
    };

    return t;
  }(document, 'script', 'twitter-wjs'));
}


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
