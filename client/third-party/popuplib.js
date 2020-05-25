//  Copyright 2009 Google Inc.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.


//  PopupManager is a library to facilitate integration with OpenID
//
//    [Note: that was OpenID 1.0, now (year 2020) since long gone,
//    but the open-popup code here, still works fine.  /KajMagnus]
//
//  identity providers (OP)s that support a pop-up authentication interface.
//  To create a popup window, you first construct a popupOpener customized
//  for your site and a particular identity provider, E.g.:
//
//  var googleOpener = popupManager.createOpener(openidParams);
//
//  where 'openidParams' are customized for Google in this instance.
//  (typically you just change the openidpoint, the version number
//  (the openid.ns parameter) and the extensions based on what
//  the OP supports.
//  OpenID libraries can often discover these properties
//  automatically from the location of an XRD document.
//
//  Then, you can either directly call
//  googleOpener.popup(width, height), where 'width' and 'height' are your choices
//  for popup size, or you can display a button 'Sign in with Google' and set the
//..'onclick' handler of the button to googleOpener.popup()

var popupManager = {};

// Library constants
// COULD_OPTIMIZE SMALLER_BUNDLE  remove more unneeded stuff /kajmagnus
popupManager.constants = {
  'darkCover' : 'popupManager_darkCover_div',
  'darkCoverStyle' : ['position:absolute;',
                      'top:0px;',
                      'left:0px;',
                      'padding-right:0px;',
                      'padding-bottom:0px;',
                      'background-color:#000000;',
                      'opacity:0.5;', //standard-compliant browsers
    // SMALLER_BUNDLE  DO_AFTER 2021-01 remove this backw compat stuff?
    // Was probably IE 7 or 8 or sth like that.
                      '-moz-opacity:0.5;',           // old Mozilla 
                      'filter:alpha(opacity=0.5);',  // IE
                      'z-index:10000;',
                      'width:100%;',
                      'height:100%;'
                      ].join('')
};

// Computes the size of the window contents. Returns a pair of
// coordinates [width, height] which can be [0, 0] if it was not possible
// to compute the values.
popupManager.getWindowInnerSize = function() {
  var width = 0;
  var height = 0;
  var elem = null;
  if ('innerWidth' in window) {
    // For non-IE
    width = window.innerWidth;
    height = window.innerHeight;
  } else {
    // For IE,
    // SMALLER_BUNDLE  DO_AFTER 2021-01 remove this? Was probably IE 7 or 8 or sth like that.
    if (('BackCompat' === window.document.compatMode)
        && ('body' in window.document)) {
        elem = window.document.body;
    } else if ('documentElement' in window.document) {
      elem = window.document.documentElement;
    }
    if (elem !== null) {
      width = elem.offsetWidth;
      height = elem.offsetHeight;
    }
  }
  return [width, height];
};

// Computes the coordinates of the parent window.
// Gets the coordinates of the parent frame
popupManager.getParentCoords = function() {
  var width = 0;
  var height = 0;
  if ('screenLeft' in window) {
    // IE-compatible variants
    // SMALLER_BUNDLE  DO_AFTER 2021-01 remove this? Was probably IE 7 or 8 or sth like that.
    width = window.screenLeft;
    height = window.screenTop;
  } else if ('screenX' in window) {
    // Firefox-compatible
    width = window.screenX;
    height = window.screenY;
  }
  return [width, height];
};

// Computes the coordinates of the new window, so as to center it
// over the parent frame
popupManager.getCenteredCoords = function(width, height) {
   var parentSize = this.getWindowInnerSize();
   var parentPos = this.getParentCoords();
   var xPos = parentPos[0] +
       Math.max(0, Math.floor((parentSize[0] - width) / 2));
   var yPos = parentPos[1] +
       Math.max(0, Math.floor((parentSize[1] - height) / 2));
   return [xPos, yPos];
};

//  A utility class, implements an onOpenHandler that darkens the screen
//  by overlaying it with a semi-transparent black layer. To use, ensure that
//  no screen element has a z-index at or above 10000.
//  This layer will be suppressed automatically after the screen closes.
//
//  Note: If you want to perform other operations before opening the popup, but
//  also would like the screen to darken, you can define a custom handler
//  as such:
//  var myOnOpenHandler = function(inputs) {
//    .. do something
//    popupManager.darkenScreen();
//    .. something else
//  };
//  Then you pass myOnOpenHandler as input to the opener, as in:
//  var openidParams = {};
//  openidParams.onOpenHandler = myOnOpenHandler;
//  ... other customizations
//  var myOpener = popupManager.createOpener(openidParams);
popupManager.darkenScreen = function() {
  var darkCover = window.document.getElementById(window.popupManager.constants['darkCover']);
  if (!darkCover) {
    darkCover = window.document.createElement('div');
    darkCover['id'] = window.popupManager.constants['darkCover'];
    darkCover.setAttribute('style', window.popupManager.constants['darkCoverStyle']);
    window.document.body.appendChild(darkCover);
  }
  darkCover.style.visibility = 'visible';
};
