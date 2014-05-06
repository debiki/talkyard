
gulpfile.js concatenates these files:
- parent-header.js
- some other files, including iframe-parent.js
- parent-footer.js

parent-header.js + parent-footer.js together uses LaizyLoad.js to automatically load
jQuery and Modernizr unless they've already been loaded. Afterwards they run Debiki's
code, which they've wrapped in a certain function, runDebikisCode().


