/**
 * Copyright (c) 2023 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/// <reference path="../more-prelude.more.ts" />
/// <reference path="user-activity.more.ts" />

//------------------------------------------------------------------------------
   namespace debiki2.users {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;


export const UserTasks = React.createFactory<PatPanelProps>(function(props: PatPanelProps) {
  // displayName: 'UsersTasks',

  const [state, setState] = React.useState({ onlyOpen: true });
  const store: Store = props.store;
  const user: UserDetailsStatsGroups = props.user;
  const me: Myself = store.me;

  const childProps: PatPostsPanelProps = {
    store,
    user,
    me,
    showWhat: 'Tasks',
    onlyOpen: state.onlyOpen,
  };

  // REFACTOR, break out fn, dupl code. [post_list_dupl_html]
  return rFr({},
      Input({ type: 'checkbox', className: 'e_OnlyOpnTsks',
        label: `Include closed tasks (e.g. because they got done)`,
        checked: !state.onlyOpen, onChange: (event: CheckboxEvent) => {
          setState({ onlyOpen: !event.target.checked });
        } }),

    // Without table-layout: fixed, the table can become 5000 px wide, because otherwise the
    // default layout is width = as wide as the widest cell wants to be.
    r.div({ style: { display: 'table', width: '100%', tableLayout: 'fixed' }},
      r.div({ style: { display: 'table-row' }},
        r.div({ className: 's_UP_Act_Nav' },
          r.ul({ className: 'dw-sub-nav nav-stacked nav nav-pills' },
            // LiNavLink({ to: ... },
            )),
        r.div({ className: 's_UP_Act_List e_UP_TskL' },
          UsersPosts(childProps)))));
});


//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------
// vim: fdm=marker et ts=2 sw=2 tw=0 fo=r list
