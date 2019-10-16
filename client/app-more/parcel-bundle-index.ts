// The Makefile makes Parcel bundles and tree-shakes all this, to:
//  target/client/more-parcel-bundle.min.js
// which gets included in the more-bundle, by gulpfile.js.

import DatePicker from "react-datepicker";
//import "react-datepicker/dist/react-datepicker.css";  — incl in gulpfile.js [305RKTFA]

import { formatDistance, subDays } from 'date-fns';

const rcf = window['reactCreateFactory'];

const tyEs6 = {
  DatePicker: rcf(DatePicker),
  dateFns: {
    formatDistance,
  }
};

window['tyEs6'] = tyEs6;

/* Could instead do this, combined with  --global parcel_global in the Makefile,
but why? Results in slightly larger bundle, & is more complicated?

module.exports = {
  testglobal: 'testglobal',
}
*/
