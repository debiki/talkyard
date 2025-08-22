/*
 * Copyright (c) 2015-2018 Kaj Magnus Lindberg
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
/// <reference path="../utils/utils.ts" />
/// <reference path="../utils/react-utils.ts" />
/// <reference path="../rules.ts" />
/// <reference path="../more-bundle-not-yet-loaded.ts" />

//------------------------------------------------------------------------------
  namespace debiki2.avatar {
//------------------------------------------------------------------------------

const NumAvatarColors = 10;
const AvatarColorHueDistance = 360 / NumAvatarColors;
let textAvatarsTaken = {}; // for now [95MFU2]
let textAvatarsByUserId = {}; // for now [95MFU2]


export function resetAvatars() {
  textAvatarsTaken = {}; // for now [95MFU2]
  textAvatarsByUserId = {};
}


export const Avatar = createFactory<AvatarProps, {}>({
  displayName: 'Avatar',

  onClick: function(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    const props: AvatarProps = this.props;
    morebundle.openAboutUserDialog(props.user.id, event.target, props.title);
  },

  tiny: function() {
    const props: AvatarProps = this.props;
    return !props.size || props.size === AvatarSize.Tiny;
  },

  makeTextAvatar: function() {
    const props: AvatarProps = this.props;
    const user: BriefUser = props.user;
    const hidden = props.hidden;
    let result = textAvatarsByUserId[user.id];
    if (result)
      return result;

    let color;
    let colorIndex;
    let firstLetterInName;
    let isGuestClass = '';
    let manyLettersClass = '';

    if (user.username && user.username.indexOf('__sx_') === -1) {  // [2QWGRC8P]
      firstLetterInName = user.username[0].toUpperCase();
    }
    else if (user.fullName) {
      firstLetterInName = user.fullName[0].toUpperCase();  // [7ED8A2M]
    }
    else if (user.isAnon) {
      firstLetterInName = '?';
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
      colorIndex = user.id % NumAvatarColors;
      const hue = AvatarColorHueDistance * colorIndex;
      let saturation = 58;
      let lightness = 76;
      if (this.tiny()) {
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
      // Give all guests and anonyms the same boring gray color.
      isGuestClass = ' esAvtr-gst';
    }

    // Append a number to make the letters unique on this page.
    // Possibly different numbers on different pages, for the same user.
    const isUnknownHiddenOrGone =
            user.id === UnknownUserId || user.id == Pats.FutureAnonId ||
            hidden || user_isGone(user);
    let number = 1;
    let text = user.id == Pats.FutureAnonId ? 'A?' : (
                  isUnknownHiddenOrGone ? '?' : firstLetterInName);
    let textAndColor = text + colorIndex;
    let alreadyInUse = !isUnknownHiddenOrGone && textAvatarsTaken[textAndColor];
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

    // Show a many-people icon, instead of a character, for groups.
    if (user.isGroup) {
      result.text = '';
      result.classes = ' icon-users' + result.classes;
    }

    if (!hidden) {
      textAvatarsTaken[textAndColor] = true;
      textAvatarsByUserId[user.id] = result;
    }
    return result;
  },

  render: function() {
    const props: AvatarProps = this.props;
    const user: BriefUser | MemberInclDetails = props.user;
    const ignoreClicks = props.ignoreClicks ||
        // The user is unknow when rendering the author avatar, in
        // the new reply preview, if we haven't logged in. [305KGWGH2]
        user.id === UnknownUserId;

    // One or more of these might be undefined, even if the user has an avatar:
    // hash paths for only *some* avatar sizes are included.
    const medPath = (<MemberInclDetails> user).avatarMediumHashPath;
    const smlPath = (<BriefUser> user).avatarSmallHashPath;
    const tnyPath = (<BriefUser> user).avatarTinyHashPath;

    let extraClasses = this.tiny() ? ' esAvtr-tny' : '';
    extraClasses += ignoreClicks ? ' esAv-IgnoreClicks' : '';
    let content;
    let style;

    const largestPicPath = medPath || smlPath || tnyPath;
    if (largestPicPath) {
      // If we don't know the hash path to the avatar of the requested size, then use another size.
      let picPath;
      if (props.size === AvatarSize.Medium) {
        picPath = largestPicPath;
      }
      else if (props.size === AvatarSize.Small) {
        picPath = smlPath || tnyPath || medPath;
      }
      else {
        picPath = tnyPath || smlPath || medPath;
      }
      const origins: Origins = props.origins;
      content = r.img({ src: linkToUpload(origins, picPath) });
    }
    else {
      const lettersClassesColor = this.makeTextAvatar();
      extraClasses += lettersClassesColor.classes;
      content = lettersClassesColor.text;
      if (lettersClassesColor.color) {
        style = { backgroundColor: lettersClassesColor.color };
      }
    }
    let title = user.username || user.fullName;
    if (props.title) {
      title += ' — ' + props.title;
    }

    if (props.showIsMine) {
      content = rFr({}, content,
          r.span({ className: 'n_Me' }, t.You));
    }

    // Later: If including some is-admin/moderator symbol, then need to uncache pages
    // where this avatar is shown. [5KSIQ24]

    const elemFn = ignoreClicks ? r.span : TyLink;
    const href = ignoreClicks ? null : linkToUserProfilePage(user);
    const onClick = ignoreClicks || props.clickOpensUserProfilePage ?
        null : this.onClick;

    return (
      elemFn({ className: 'esAvtr edAvtr' + extraClasses, href, title, style, onClick },
        content));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 list
