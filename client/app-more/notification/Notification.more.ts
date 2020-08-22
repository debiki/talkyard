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
    const byUser = notf.byUser;
    const byName = byUser.username || byUser.fullName;
    let textContent = '';
    let iconClass = '';
    let toMeClass = ' esNotf-toMe';
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
      case NotificationType.OneLikeVote:
        iconClass = 'icon-heart';
        break;
      default:
        die("Unknown notification type [EsE4GUF2]")
    }
    let when;
    let verboseClass = '';
    if (this.props.verbose) {
      when = r.span({}, " — " + moment(notf.createdAtMs).fromNow());
      verboseClass = ' esNotf-vrbs';
    }
    return (
      r.span({ className: ' esNotf' + verboseClass + toMeClass + seenClass },
        r.span({ className: iconClass }, textContent),
        r.span({ className: 'esNotf_by' }, byName), ": ",
        r.span({ className: 'esNotf_page' }, notf.pageTitle),
        when));
  }
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
