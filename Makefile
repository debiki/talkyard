# This makefile is called two times by SBT;
# Once to compile_javascript to Java bytecode.
# And once to combine_and_gzip_javascript.

DESTDIR=target/scala-2.9.1/classes/
CLASSDIR=${DESTDIR}compiledjs/
HTML_SANITIZER_JS=app/assets/res/html-sanitizer-bundle.js
SHOWDOWN_JS=public/res/wmd/showdown.js
RHINOJAR=/mnt/data/dev/play/github/repository/local/rhino/js/1.7R2/jars/js.jar

help:
	@echo Open the Makefile and read it.

# Compile Javascript to Java bytecode, using Mozilla Rhino.
# There're some duplicated rules unfortunately.

compile_javascript: \
		${CLASSDIR}HtmlSanitizerJsImpl.class \
		${CLASSDIR}ShowdownJsImpl.class

${CLASSDIR}HtmlSanitizerJsImpl.class: ${CLASSDIR}HtmlSanitizerJs.class ${RHINOJAR} ${HTML_SANITIZER_JS}
	java -cp ${RHINOJAR}:${DESTDIR} \
	  org.mozilla.javascript.tools.jsc.Main \
	  -opt 9 \
	  -implements compiledjs.HtmlSanitizerJs \
	  -package compiledjs \
	  -d ${DESTDIR} \
	  -o HtmlSanitizerJsImpl \
	  ${HTML_SANITIZER_JS}

${CLASSDIR}ShowdownJsImpl.class: ${CLASSDIR}ShowdownJs.class ${RHINOJAR} ${SHOWDOWN_JS}
	java -cp ${RHINOJAR}:${DESTDIR} \
	  org.mozilla.javascript.tools.jsc.Main \
	  -opt 9 \
	  -implements compiledjs.ShowdownJs \
	  -package compiledjs \
	  -d ${DESTDIR} \
	  -o ShowdownJsImpl \
	  ${SHOWDOWN_JS}

${RHINOJAR}:
	echo 'No Rhino jar, please run `play update`.'
	exit 1

HtmlSanitizerJs: ${CLASSDIR}HtmlSanitizerJs.class
${CLASSDIR}HtmlSanitizerJs.class: app/compiledjs/HtmlSanitizerJs.java
	mkdir -p ${DESTDIR}
	javac $< -d ${DESTDIR}

ShowdownJs: ${CLASSDIR}ShowdownJs.class
${CLASSDIR}ShowdownJs.class: app/compiledjs/ShowdownJs.java
	mkdir -p ${DESTDIR}
	javac $< -d ${DESTDIR}


cleanjs:
	rm -f ${CLASSDIR}ShowdownJs.class ${CLASSDIR}HtmlSanitizerJs.class
	rm -f ${CLASSDIR}ShowdownJsImpl.class ${CLASSDIR}HtmlSanitizerJsImpl.class
	rm -f ${CLASSDIR}ShowdownJsImpl1.class ${CLASSDIR}HtmlSanitizerJsImpl1.class


# Combine some Javascript files, and gzip the resulting files, so Play will serve them
# gzip compressed.

PUBLIC_JS_DIR=target/scala-2.9.1/classes/public/res/

JS_DESKTOP_MIN_JS=${PUBLIC_JS_DIR}combined-debiki-desktop.min.js
JS_TOUCH_MIN_JS=${PUBLIC_JS_DIR}combined-debiki-touch.min.js
JS_LOGIN_MIN_JS=${PUBLIC_JS_DIR}combined-debiki-login.min.js

JS_DESKTOP_MIN_JS_GZ=${JS_DESKTOP_MIN_JS}.gz
JS_TOUCH_MIN_JS_GZ=${JS_TOUCH_MIN_JS}.gz
JS_LOGIN_MIN_JS_GZ=${JS_LOGIN_MIN_JS}.gz

DEBIKI_JS=${PUBLIC_JS_DIR}debiki.js
DEBIKI_MIN_JS=${PUBLIC_JS_DIR}debiki.min.js

${DEBIKI_MIN_JS}: ${DEBIKI_JS}
	# no: uglifyjs $^ > $@    because results in corrupt Javascript
	java -jar scratch/yuicompressor-2.4.6.jar --line-break 280 --charset utf8 -o $@ $^

# This file: ${PUBLIC_JS_DIR}html-sanitizer-bundle.min.js is included in debiki.min.js
# by Play or Google Closure Compiler or something.

JS_COMMON_SRC = \
  ${PUBLIC_JS_DIR}diff_match_patch.js \
  ${PUBLIC_JS_DIR}jquery-cookie.js \
  ${PUBLIC_JS_DIR}javascript-yaml-parser.js \
  ${PUBLIC_JS_DIR}debiki-util.min.js \
  ${PUBLIC_JS_DIR}debiki-scroll-into-view.min.js \
  ${PUBLIC_JS_DIR}debiki-merge-changes.min.js \
  ${PUBLIC_JS_DIR}debiki-arrows-png.min.js \
  ${PUBLIC_JS_DIR}debiki-arrows-svg.min.js \
  ${PUBLIC_JS_DIR}debiki-jquery-dialogs.min.js \
  ${PUBLIC_JS_DIR}debiki-form-anims.min.js \
  ${PUBLIC_JS_DIR}debiki-http-dialogs.min.js \
  ${PUBLIC_JS_DIR}debiki-cur-user.min.js \
  ${PUBLIC_JS_DIR}debiki-login.min.js \
  ${PUBLIC_JS_DIR}debiki-login-guest.min.js \
  ${PUBLIC_JS_DIR}debiki-login-openid.min.js \
  ${PUBLIC_JS_DIR}debiki-logout-dialog.min.js \
  ${PUBLIC_JS_DIR}debiki-markup.min.js \
  ${PUBLIC_JS_DIR}debiki-action-links.min.js \
  ${PUBLIC_JS_DIR}debiki-action-reply.min.js \
  ${PUBLIC_JS_DIR}debiki-action-rate.min.js \
  ${PUBLIC_JS_DIR}debiki-action-flag.min.js \
  ${PUBLIC_JS_DIR}debiki-action-delete.min.js \
  ${PUBLIC_JS_DIR}debiki-edit-history.min.js

# Depends on stuff in ${DEBIKI_MIN_JS}. (tagdog.js depends on html-sanitizer-bundle.js.)
JS_COMMON_SRC_2 = \
  ${PUBLIC_JS_DIR}tagdog.js

JS_TOUCH_ONLY_SRC = \
  ${PUBLIC_JS_DIR}android-zoom-bug-workaround.min.js

JS_DESKTOP_ONLY_SRC = \
  ${PUBLIC_JS_DIR}jquery-scrollable.js \
  ${PUBLIC_JS_DIR}debiki-utterscroll.min.js \
  ${PUBLIC_JS_DIR}debiki-keyboard-shortcuts.min.js \
  ${PUBLIC_JS_DIR}bootstrap-tooltip.js

JS_LOGIN_SRC = \
  ${PUBLIC_JS_DIR}popuplib.js \
  ${PUBLIC_JS_DIR}openid-selector/js/openid-jquery.js \
  ${PUBLIC_JS_DIR}openid-selector/js/openid-en.js

JS_TOUCH_SRC = \
  ${JS_COMMON_SRC} \
  ${JS_TOUCH_ONLY_SRC} \
  ${DEBIKI_MIN_JS} \
  ${JS_COMMON_SRC_2}

# For now, don't include JS_LOGIN_SRC. I'll load those files one at a time,
# so I don't have to rewrite that much Javascript right now.
JS_DESKTOP_SRC = \
  ${JS_COMMON_SRC} \
  ${JS_DESKTOP_ONLY_SRC} \
  ${DEBIKI_MIN_JS} \
  ${JS_COMMON_SRC_2}

combine_and_gzip_javascript: ${JS_DESKTOP_MIN_JS_GZ} ${JS_TOUCH_MIN_JS_GZ} ${JS_LOGIN_MIN_JS_GZ}

# (How can I merge the dupl code in these 2 x 3 rules?)

${JS_DESKTOP_MIN_JS}: ${JS_DESKTOP_SRC}
	cat $^ > $@

${JS_TOUCH_MIN_JS}: ${JS_TOUCH_SRC}
	cat $^ > $@

${JS_LOGIN_MIN_JS}: ${JS_LOGIN_SRC}
	cat $^ > $@

${JS_DESKTOP_MIN_JS_GZ}: ${JS_DESKTOP_MIN_JS}
	gzip -c $^ > $@

${JS_TOUCH_MIN_JS_GZ}: ${JS_TOUCH_MIN_JS}
	gzip -c $^ > $@

${JS_LOGIN_MIN_JS_GZ}: ${JS_LOGIN_MIN_JS}
	gzip -c $^ > $@

clean_combined_js:
	rm ${JS_DESKTOP_MIN_JS}
	rm ${JS_TOUCH_MIN_JS}
	rm ${JS_LOGIN_MIN_JS}
	rm ${JS_DESKTOP_MIN_JS_GZ}
	rm ${JS_TOUCH_MIN_JS_GZ}
	rm ${JS_LOGIN_MIN_JS_GZ}



clean: cleanjs clean_combined_js

.PHONY: cleanjs clean_combined_js clean

# vim: list
