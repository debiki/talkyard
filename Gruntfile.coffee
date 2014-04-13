###
(Run `gulp` instead, it'll call `grunt` for you.)

Build file for client scripts and styles. See http://gruntjs.com/
Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
###


module.exports = (grunt) ->

  grunt.loadNpmTasks('grunt-contrib-concat')
  grunt.loadNpmTasks('grunt-contrib-uglify')


  grunt.initConfig({
    pkg: '<json:package.json>',
    concat: {
      # Finds theme specific files in app/views/themes/<themeName>/<bundleName>/*.css
      # and concatenates them to public/themes/<themeName>/<bundleName>
      # and <bundleName> must currently be 'styles.css'.
      themes: {
        files: [{
          expand: true,
          cwd: 'app/views/themes/',
          src: '*/styles.css/*.css',
          dest: 'public/themes/',
          rename: (dest, src) ->
            # `dest` is:  public/themes/
            # `src` is:  <themeName>/<bundleName>/<fileName>
            grunt.verbose.writeln('Placing source file: ' + src)
            matchesArray = src.match(
                #<theme name>   <bundle name>  <file name>
                #e.g. ex_theme e.g. styles.css e.g. some-file.css
                /^([a-z0-9_]+)\/([a-z0-9_.]+)\/[a-z0-9_.-]+$/)
            themeName = matchesArray[1]
            bundleName = matchesArray[2]
            grunt.verbose.writeln('in theme/bundle: ' + themeName + '/' + bundleName)
            dest + themeName + '/' + bundleName
        }]
      }
    },
    uglify: {
      # Minifies ./public/res/*.js to *.min.js in the same directory.
      server: {
        options: {
          # Preserves bang comments: /*!  ... */ added by the 'concat' target.
          preserveComments: 'some'
        },
        expand: true,
        cwd: 'public/res/',
        src: ['*.js', '!*.min.js'],
        dest: 'public/res/',
        ext: '.min.js',
      }
    }
  })

  grunt.registerTask('default', ['concat'])
  grunt.registerTask('release', ['concat', 'uglify'])


# vim: et ts=2 sw=2 list
