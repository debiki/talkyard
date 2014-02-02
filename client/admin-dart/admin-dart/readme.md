
Build this Dart project (pub build), start Play and go here:
  http://localhost:9000/-/assets/39/admin-dart-build/index.html

There's a softlink from Play's resources dir to Dart's build dir, that's why it works.


Re CSS: Grunt bundles the Stylus files in client/admin-dart/styles/ to
./styles.css. So don't edit styles.css directly; your changes would be
overwritte.  (To have Grunt bundle the Stylus files, run `grunt` in the repo
base dir, or `grunt watch`.)

