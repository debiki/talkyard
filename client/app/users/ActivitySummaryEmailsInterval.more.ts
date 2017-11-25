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

/// <reference path="../slim-bundle.d.ts" />

//------------------------------------------------------------------------------
   namespace debiki2 {
//------------------------------------------------------------------------------

const r = ReactDOMFactories;
const DropdownModal = utils.DropdownModal;
const ExplainingListItem = util.ExplainingListItem;

// Also in Scala [5WKIQU2]. And there's also the default interval: [5JUKWQ01].
export const DisableSummaryEmails = -1;

const OneWeekInMinutes = 7 * 24 * 60;
export const DefaultSummaryIntervalMins = OneWeekInMinutes;


export const ActivitySummaryEmailsIntervalDropdown = createComponent({
  displayName: 'ActivitySummaryEmailsIntervalDropdown',

  getInitialState: function() {
    return {
      open: false,
      buttonX: -1,
      buttonY: -1,
    };
  },

  open: function() {
    this.setState({
      open: true,
      windowWidth: window.innerWidth,
      buttonRect: reactGetRefRect(this.refs.dropdownButton),
    });
  },

  close: function() {
    this.setState({ open: false });
  },

  onSelect: function(listItem) {
    if (this.props.onSelect) {
      this.props.onSelect(listItem.eventKey);
    }
    this.close();
  },

  render: function() {
    const props = this.props;

    // Also in Scala: [7GKW4E1]
    const thirtyMinutesMins = 30;
    const hourlyMins = 60;
    const dailyMins = 60 * 24;
    const twicePerWeekMins = OneWeekInMinutes / 2;
    const weeklyMins = OneWeekInMinutes;
    const everySecondWeekMins = OneWeekInMinutes * 2;
    const monthlyMins = 60 * 24 * 365 / 12;

    const activeIntervalMins = props.intervalMins || DefaultSummaryIntervalMins;

    function intervalToText(intervalMins: number): string {
      switch (intervalMins) {
        case thirtyMinutesMins: return "Every 30 minutes";
        case hourlyMins: return "Hourly";
        case dailyMins: return "Daily";
        case twicePerWeekMins: return "Twice per week";
        case weeklyMins: return "Weekly";
        case everySecondWeekMins: return "Every second week";
        case monthlyMins: return "Monthly";
        case DisableSummaryEmails: return "Never";
        default: return `Every ${intervalMins} minutes`;
      }
    }

    const dropdownButton =
      Button({ onClick: this.open, ref: 'dropdownButton', className: 'esTopicType_dropdown',
          disabled: this.props.disabled },
        intervalToText(activeIntervalMins), ' ', r.span({ className: 'caret' }));

    const makeItem = (intervalMins) => {
      return ExplainingListItem({ onSelect: this.onSelect,
        activeEventKey: activeIntervalMins, eventKey: intervalMins,
        title: intervalToText(intervalMins) });
    };

    const dropdownModal =
      DropdownModal({ show: this.state.open, onHide: this.close, showCloseButton: true,
          atRect: this.state.buttonRect, windowWidth: this.state.windowWidth },
        r.ul({},
          // We don't currently keep track of popular topics per hour. Only per day/week/longer.
          // So disable these two, for now: (although presumably they make sense — because
          // they're supported by Discourse. Not sure about the use case :-P )
          // makeItem(thirtyMinutesMins),
          // makeItem(hourlyMins),
          makeItem(dailyMins),
          makeItem(twicePerWeekMins),
          makeItem(weeklyMins),
          makeItem(everySecondWeekMins),
          makeItem(monthlyMins)));
          // Don't include Never — that's a checkbox instead. [7PK4WY1]

    return (
      r.div({},
        dropdownButton,
        dropdownModal));
  }
});

//------------------------------------------------------------------------------
   }
//------------------------------------------------------------------------------

