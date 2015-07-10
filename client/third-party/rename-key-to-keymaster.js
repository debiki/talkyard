// keymaster.js declare a global variable window.key, but on my prod server
// then very infrequently window.key is overwritten by something to ' _ga'
// which results in:  Uncaught TypeError: string is not a function
// Prevent this, by not using windows.key, instead use windows.keymaster.
if (window && window.key) {
  if (window.keymaster && console && console.warn) {
    console.warn('window.keymaster already defined, overwriting it with window.key [DwE4KEPB2]');
  }
  window.keymaster = window.key;
  window.key = 'Use window.keymaster instead [DwE7VEGP8]';
}

