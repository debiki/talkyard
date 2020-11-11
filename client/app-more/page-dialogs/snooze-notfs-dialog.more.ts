/*
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

/// <reference path="../more-prelude.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.pagedialogs {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
var Modal = rb.Modal;
var ModalHeader = rb.ModalHeader;
var ModalTitle = rb.ModalTitle;
var ModalBody = rb.ModalBody;
var ModalFooter = rb.ModalFooter;


let dialog;

let dialogSetState: (_: [any]) => void;

export function openSnoozeDialog(me: Myself) {
  if (!dialog) {
debugger;
    // ??? does render() return null here? and we're creating many dlgs?
    dialog = ReactDOM.render(SnoozeDialog(), utils.makeMountNode());  // or [use_portal] ?
  }
  dialogSetState([me]);
}


const SnoozeDialog = React.createFactory<{}>(function() {
  const [diagState, setDiagState] = React.useState<[Myself]>(null);
  const [minsToSnooze, setMinsToSnooze] = React.useState<number>(4 * 60);

  dialogSetState = setDiagState;

  const me: Myself | U = diagState && diagState[0];
  const isOpen = !!me;
  const snzLeftMs = me && pp_snoozeLeftMs(me);

  function close() {
    setDiagState(null);
  }

  function toggleSnooze() {
    ReactActions.snoozeUntilMins(snzLeftMs ? false : getNowMins() + minsToSnooze);
    close();
  }

  const modalHeader = isOpen &&
      ModalHeader({},
        ModalTitle({},
          snzLeftMs ? "Stop snoozing?" : "Snooze notifications?"));  // I18N

  const nowMs = getNowMs();
  const endMs = nowMs + (minsToSnooze ? minsToSnooze * 60 * 1000 : snzLeftMs);

  function formatTime(ms: WhenMs, inclDate?: boolean): string {
    return moment.utc(ms).local().format(inclDate ? 'YYYY-MM-DD HH:mm' : 'HH:mm');
  }

  const snozingUntil =
        r.p({},
            "Snoozing until: " + formatTime(endMs, true), r.br(), // I18N
            "Time now: " + formatTime(nowMs));  // I18N

  const moringBtn = (days, text) =>
    Button({ className: 's_SnzD_9amB', onClick: () => {
        const nowMs = getNowMs();
        const d = new Date(nowMs);
        // If days = 1, this'll be tomorrow, 09:00:00:00 (hour, min, secs, ms).
        const laterMs = d.setHours(24 * days + 9, 0, 0, 0);
        const minsDiff = Math.trunc((laterMs - nowMs) / 1000 / 60);
        // Add 1 min because gets truncated to 1 min less.
        setMinsToSnooze(minsDiff + 1);
      },
    }, text);

  const modalBody = isOpen && (!snzLeftMs
      ? ModalBody({},
          r.p({}, "Stop email notifications, for how many hours?"),   // I18N
          Input({ type: 'number', value: minsToSnooze / 60,
              onChange: (event) =>
                  setMinsToSnooze(Math.max(event.target.value, 0) * 60) }),
          r.div({ className: 's_SnzD_9amBs' },
            moringBtn(1, "09:00 tomorrow morning"),  // I18N
            moringBtn(2, "09:00 2 days"),
            moringBtn(3, "09:00 3 days")),
          minsToSnooze > 0 && snozingUntil,
          PrimaryButton({ onClick: toggleSnooze, className: 'e_SnzB' },
            "Snooze"))   // I18N
      : ModalBody({},
          snozingUntil,
          r.p({}, "Start receiving email notifications now directly?"),   // I18N
          PrimaryButton({ onClick: toggleSnooze, className: 'e_UnSnzB' },
            "Yes, stop snoozing")));   // I18N

  const modalFooter = isOpen &&
      ModalFooter({},
        Button({ onClick: close }, t.Cancel));

  return (
      Modal({ show: isOpen, onHide: close, dialogClassName: 's_SnzD' },
        modalHeader,
        modalBody,
        modalFooter));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
