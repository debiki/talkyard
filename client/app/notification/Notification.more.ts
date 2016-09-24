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

/// <reference path="../../typedefs/react/react.d.ts" />
/// <reference path="../../typedefs/moment/moment.d.ts" />
/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   module debiki2.notification {
//------------------------------------------------------------------------------

var r = React.DOM;


export var Notification = createComponent({
  render: function() {
    var notf: Notification = this.props.notification;
    var byUser = notf.byUser;
    var byName = byUser.username || byUser.fullName;
    var textContent = '';
    var iconClass = '';
    var toMeClass = ' esNotf-toMe';
    var seenClass = notf.seen ? ' esNotf-seen' : '';
    switch (notf.type) {
      case NotificationType.DirectReply: iconClass = 'icon-reply'; break;
      case NotificationType.Mention: iconClass = 'icon-char'; textContent = '@'; break;
      case NotificationType.Message: iconClass = 'icon-mail-empty'; break;
      case NotificationType.NewPost: iconClass = 'icon-comment-empty'; toMeClass = ''; break;
      case NotificationType.PostTagged: iconClass = 'icon-tag'; toMeClass = ''; break;
      default: die("Unknown notification type [EsE4GUF2]")
    }
    var when;
    var verboseClass = '';
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



export var NotfLevelButton = createComponent({
  render: function() {
    var subject: NotfSubject = this.props.subject;
    var notfLevel: NotfLevel = this.props.notfLevel;
    return (
      Button({ id: '7bw3gz5', className: 'dw-notf-level',
          onClick: event => page.openNotfsLevelDropdown(event.target, subject, notfLevel ) },
        r.span({}, notfLevel_title(notfLevel) + ' ', r.span({className: 'caret'}))));
  }
});



//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=tcqwn list
