/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

// This file is appended to embedded-comments.js by gulpfile.js.
// See readme.txt.


}; // end of runDebikisCode()

// Inline LazyLoad minified, https://github.com/rgrove/lazyload/
// version 7ac401a8 from Jan 11, 2014
// LazyLoad is Copyright (c) 2011 Ryan Grove, all rights reserved,
// and licensed under the MIT license, see the GitHub repo linked above.
// Minified by: http://jscompress.com/ January 16 2014.
// After minifying it and pasting it into this Coffescript string,
/*
LazyLoad=function(e){function u(t,n){var r=e.createElement(t),i;for(i in n){if(n.hasOwnProperty(i)){r.setAttribute(i,n[i])}}return r}function a(e){var t=r[e],n,o;if(t){n=t.callback;o=t.urls;o.shift();i=0;if(!o.length){n&&n.call(t.context,t.obj);r[e]=null;s[e].length&&l(e)}}}function f(){var n=navigator.userAgent;t={async:e.createElement("script").async===true};(t.webkit=/AppleWebKit\//.test(n))||(t.ie=/MSIE|Trident/.test(n))||(t.opera=/Opera/.test(n))||(t.gecko=/Gecko\//.test(n))||(t.unknown=true)}function l(i,o,l,p,d){var v=function(){a(i)},m=i==="css",g=[],y,b,w,E,S,x;t||f();if(o){o=typeof o==="string"?[o]:o.concat();if(m||t.async||t.gecko||t.opera){s[i].push({urls:o,callback:l,obj:p,context:d})}else{for(y=0,b=o.length;y<b;++y){s[i].push({urls:[o[y]],callback:y===b-1?l:null,obj:p,context:d})}}}if(r[i]||!(E=r[i]=s[i].shift())){return}n||(n=e.head||e.getElementsByTagName("head")[0]);S=E.urls.concat();for(y=0,b=S.length;y<b;++y){x=S[y];if(m){w=t.gecko?u("style"):u("link",{href:x,rel:"stylesheet"})}else{w=u("script",{src:x});w.async=false}w.className="lazyload";w.setAttribute("charset","utf-8");if(t.ie&&!m&&"onreadystatechange"in w&&!("draggable"in w)){w.onreadystatechange=function(){if(/loaded|complete/.test(w.readyState)){w.onreadystatechange=null;v()}}}else if(m&&(t.gecko||t.webkit)){if(t.webkit){E.urls[y]=w.href;h()}else{w.innerHTML='@import "'+x+'";';c(w)}}else{w.onload=w.onerror=v}g.push(w)}for(y=0,b=g.length;y<b;++y){n.appendChild(g[y])}}function c(e){var t;try{t=!!e.sheet.cssRules}catch(n){i+=1;if(i<200){setTimeout(function(){c(e)},50)}else{t&&a("css")}return}a("css")}function h(){var e=r.css,t;if(e){t=o.length;while(--t>=0){if(o[t].href===e.urls[0]){a("css");break}}i+=1;if(e){if(i<200){setTimeout(h,50)}else{a("css")}}}}var t,n,r={},i=0,s={css:[],js:[]},o=e.styleSheets;return{css:function(e,t,n,r){l("css",e,t,n,r)},js:function(e,t,n,r){l("js",e,t,n,r)}}}(this.document);
*/

/*
// Load jQuery and Modernizr unless already done. Then CSS. Then run Debiki's code.

debiki.internal.loadJQueryEtcThenRunDebiki = function() {
  if (!window.jQuery) {
    LazyLoad.js('//ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js', function() {
      debiki.internal.loadModernizrEtcThenRunDebiki();
    });
  }
  else {
    debiki.internal.loadModernizrEtcThenRunDebiki();
  }
}

debiki.internal.loadModernizrEtcThenRunDebiki = function() {
  if (!window.Modernizr) {
    LazyLoad.js('//cdnjs.cloudflare.com/ajax/libs/modernizr/2.7.1/modernizr.min.js', function() {
      debiki.internal.loadCssThenRunDebiki();
    });
  }
  else {
    debiki.internal.loadCssThenRunDebiki();
  }
} */

/*
debiki.internal.loadCssThenRunDebiki = function() {
  LazyLoad.css(debiki.internal.debikiServerOrigin + '/-/debiki-embedded-comments.css', function() {
    debiki.internal.runDebikisCode();
  });
}

//debiki.internal.loadJQueryEtcThenRunDebiki();
debiki.internal.loadCssThenRunDebiki();
*/

debiki.internal.runDebikisCode();

// vim: et sw=2 ts=2 tw=0 list
