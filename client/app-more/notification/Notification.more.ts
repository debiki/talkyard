/*
 * Copyright (c) 2015-2016 Kaj Magnus Lindberg
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

/// <reference path="../../../node_modules/moment/moment.d.ts" />
/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.notification {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const Notification = createComponent({
  render: function() {
    const notf: Notification = this.props.notification;
    const byUser: Pat = notf.byUser;
    const byName: St = byUser.username || byUser.fullName;
    let textContent = '';
    let iconClass = '';
    let toMeClass = ' esNotf-toMe';
    let assignedYou = '';
    const seenClass = notf.seen ? ' esNotf-seen' : '';

    switch (notf.type) {
      case NotificationType.DirectReply:
        iconClass = 'icon-reply';
        break;
      case NotificationType.IndirectReply:
        iconClass = 'icon-reply';
        toMeClass += ' s_Nf-2Me-Indr';
        break;
      case NotificationType.Mention:
        iconClass = 'icon-char';
        textContent = '@';
        break;
      case NotificationType.Message:
        iconClass = 'icon-mail-empty';
        break;
      case NotificationType.NewPost:
        iconClass = 'icon-comment-empty';
        toMeClass = '';
        break;
      case NotificationType.PostTagged:
        iconClass = 'icon-tag';
        toMeClass = '';
        break;
      case NotificationType.AssigneesChanged:
        toMeClass += ' s_Nf-2Me-Indr';
        assignedYou = " changed assignees"; // I18N
        // fall through
      case NotificationType.Unassigned:
        // These look similar: "assign" "unassign", when glancing quickly in the UI.
        // Could make "un" bold, but looks odd. "un-" looks ok and is simpler to
        // read (and translate?) so let's use that. Doesn't happen often anyway.
        assignedYou ||= " un-assigned you"; // I18N
        // fall through
      case NotificationType.Assigned:
        assignedYou ||= " assigned you"; // I18N
        // UX COULD show dashed, solid, checked depending on task status
        // (planned, doing, done). But then the server needs to incl
        // more info about each notf: DoingStatus, ClosedStatus.  [same_title_everywhere]
        iconClass = 'icon-check-empty'; // or 'ion-check-dashed'
        break;
      case NotificationType.OneLikeVote:
        iconClass = 'icon-heart';
        break;
      default:
        die(`Unknown notification type: ${notf.type} [TyENOTFTYP]`)
    }

    let when: RElm | U;
    let verboseClass = '';
    if (this.props.verbose) {
      when = r.span({}, " — " + moment(notf.createdAtMs).fromNow());
      verboseClass = ' esNotf-vrbs';
    }

    return (
      r.span({ className: ' esNotf' + verboseClass + toMeClass + seenClass },
        r.span({ className: iconClass }, textContent),
        r.span({ className: 'esNotf_by' }, byName), assignedYou + ": ",
        r.span({ className: 'esNotf_page' }, notf.pageTitle),
        when));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
