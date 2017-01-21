/*
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
/// <reference path="../plain-old-javascript.d.ts" />
/// <reference path="../prelude.ts" />
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../model.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
  module debiki2.avatar {
//------------------------------------------------------------------------------

var SystemUserId = -1; // also ... elsewhere?

var NumAvatarColors = 10;
var AvatarColorHueDistance = 360 / NumAvatarColors;
var textAvatarsTaken = {}; // for now [95MFU2]
var textAvatarsByUserId = {}; // for now [95MFU2]


export function resetAvatars() {
  textAvatarsTaken = {}; // for now [95MFU2]
  textAvatarsByUserId = {};
}


export var Avatar = createComponent({
  onClick: function(event) {
    if (this.props.ignoreClicks)
      return;

    event.stopPropagation();
    event.preventDefault();
    if (this.props.clickOpensUserProfilePage) {
      ReactActions.openUserProfile(this.props.user.id);
    }
    else {
      morebundle.openAboutUserDialog(this.props.user.id);
    }
  },

  makeTextAvatar: function() {
    var user: BriefUser = this.props.user;
    let hidden: boolean = this.props.hidden;
    var result = textAvatarsByUserId[user.id];
    if (result)
      return result;

    var color;
    var firstLetterInName;
    var isGuestClass = '';
    var manyLettersClass = '';

    if (user.username) {
      firstLetterInName = user.username[0].toUpperCase();
    }
    else if (user.fullName) {
      firstLetterInName = user.fullName[0].toUpperCase();  // [7ED8A2M]
    }
    else {
      debiki2.die("Name missing: " + JSON.stringify(user) + " [EdE7UMYP3]");
    }

    if (hidden) {
      // Give avatars for hidden posts the boring gray guest color.
      isGuestClass = ' esAvtr-gst';
    }
    else if (user.id > 0) {
      // Always use the same color for the same user (unless the color palette gets changed).
      var colorIndex = user.id % NumAvatarColors;
      var hue = AvatarColorHueDistance * colorIndex;
      var saturation = 58;
      var lightness = 76;
      if (this.props.tiny) {
        // Use a darker color, because otherwise hard to see these small avatars.
        // Reduce saturation too, or the color becomes too strong (since darker = more color here).
        lightness -= 4;
        saturation -= 3;
      }
      if (50 <= hue && hue <= 80) {
        // These colors (yellow, green) are hard to discern. Make them stronger.
        lightness -= 10;
        saturation -= 4;
      }
      else if (40 <= hue && hue <= 185) {
        // A bit hard to discern.
        lightness -= 5;
        saturation -= 2;
      }
      color = 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
    }
    else if (user.id === SystemUserId) {
      isGuestClass = ' esAvtr-sys';
    }
    else {
      // Give all guest users the same boring gray color.
      isGuestClass = ' esAvtr-gst';
    }

    // Append a number to make the letters unique on this page.
    // Possibly different numbers on different pages, for the same user.
    var isUnknownOrHidden = user.id === UnknownUserId || hidden;
    var number = 1;
    var text = isUnknownOrHidden ? '?' : firstLetterInName;
    var textAndColor = text + colorIndex;
    var alreadyInUse = !isUnknownOrHidden && textAvatarsTaken[textAndColor];
    while (alreadyInUse) {
      number += 1;
      if (number >= 10) {
        text = firstLetterInName + '?';
        break;
      }
      text = firstLetterInName + number;
      textAndColor = text + colorIndex;
      alreadyInUse = textAvatarsTaken[textAndColor];
    }

    if (text.length > 1) {
      manyLettersClass = ' edAvtr-manyLetters';
    }

    result = {
      text: text,
      classes: ' esAvtr-ltr' + manyLettersClass + isGuestClass,
      color: color,
    };

    if (!hidden) {
      textAvatarsTaken[textAndColor] = true;
      textAvatarsByUserId[user.id] = result;
    }
    return result;
  },

  render: function() {
    var user: BriefUser = this.props.user;
    var extraClasses = this.props.tiny ? ' esAvtr-tny' : '';
    extraClasses += this.props.ignoreClicks ? ' esAv-IgnoreClicks' : '';
    var content;
    var styles;
    if (this.props.large && user['mediumAvatarUrl']) {
      content = r.img({ src: user['mediumAvatarUrl'] });
    }
    else if (user.avatarUrl) {
      content = r.img({ src: user.avatarUrl });
    }
    else {
      var lettersClassesColor = this.makeTextAvatar();
      extraClasses += lettersClassesColor.classes;
      content = lettersClassesColor.text;
      if (lettersClassesColor.color) {
        styles = { backgroundColor: lettersClassesColor.color };
      }
    }
    var title = user.username || user.fullName;
    if (this.props.title) {
      title += ' — ' + this.props.title;
    }
    return (
      // [rename] edAvtr to esAvtr
      r.span({ className: 'esAvtr edAvtr' + extraClasses, style: styles, onClick: this.onClick,
          title: title }, content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
