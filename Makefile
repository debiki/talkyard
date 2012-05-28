# This makefile is called two times by SBT;
# Once to compile_javascript to Java bytecode.
# And once to combine_and_gzip_javascript.

DESTDIR=target/scala-2.9.1/classes/
CLASSDIR=${DESTDIR}compiledjs/
JSDIR=modules/debiki-core/src/main/resources/toserve/js/
RHINOJAR=/mnt/data/dev/play/github/repository/local/rhino/js/1.7R2/jars/js.jar

help:
	@echo Open the Makefile and read it.

# Compile Javascript to Java bytecode, using Mozilla Rhino.
# There're some duplicated rules unfortunately.

compile_javascript: \
		${CLASSDIR}HtmlSanitizerJsImpl.class \
		${CLASSDIR}ShowdownJsImpl.class

HtmlSanitizerJsImpl: ${CLASSDIR}HtmlSanitizerJsImpl.class
${CLASSDIR}HtmlSanitizerJsImpl.class: ${CLASSDIR}HtmlSanitizerJs.class ${RHINOJAR} ${JSDIR}html-sanitizer-minified.js
	java -cp ${RHINOJAR}:${DESTDIR} \
	  org.mozilla.javascript.tools.jsc.Main \
	  -opt 9 \
	  -implements compiledjs.HtmlSanitizerJs \
	  -package compiledjs \
	  -d ${DESTDIR} \
	  -o HtmlSanitizerJsImpl \
          ${JSDIR}html-sanitizer-minified.js

ShowdownJsImpl: ${CLASSDIR}ShowdownJsImpl.class
${CLASSDIR}ShowdownJsImpl.class: ${CLASSDIR}ShowdownJs.class ${RHINOJAR} ${JSDIR}wmd/showdown.js
	java -cp ${RHINOJAR}:${DESTDIR} \
	  org.mozilla.javascript.tools.jsc.Main \
	  -opt 9 \
	  -implements compiledjs.ShowdownJs \
	  -package compiledjs \
	  -d ${DESTDIR} \
	  -o ShowdownJsImpl \
          ${JSDIR}wmd/showdown.js

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

PUBLIC_JS_DIR=target/scala-2.9.1/classes/public/debiki-core-resources/js/
PUBLIC_JS_LIB_DIR=target/scala-2.9.1/classes/public/debiki-core-resources/lib/

JS_DESKTOP_MIN_JS = ${PUBLIC_JS_DIR}combined-debiki-desktop.min.js
JS_TOUCH_MIN_JS = ${PUBLIC_JS_DIR}combined-debiki-touch.min.js
JS_LOGIN_MIN_JS = ${PUBLIC_JS_DIR}combined-debiki-login.min.js

JS_DESKTOP_MIN_JS_GZ = ${JS_DESKTOP_MIN_JS}.gz
JS_TOUCH_MIN_JS_GZ = ${JS_TOUCH_MIN_JS}.gz
JS_LOGIN_MIN_JS_GZ = ${JS_LOGIN_MIN_JS}.gz

JS_COMMON_SRC = \
  ${PUBLIC_JS_DIR}diff_match_patch.js \
  ${PUBLIC_JS_DIR}html-sanitizer-minified.js \
  ${PUBLIC_JS_DIR}jquery-cookie.js \
  ${PUBLIC_JS_DIR}tagdog.js \
  ${PUBLIC_JS_DIR}javascript-yaml-parser.js

JS_DESKTOP_ONLY_SRC = \
  ${PUBLIC_JS_DIR}jquery-scrollable.js \
  ${PUBLIC_JS_DIR}debiki-utterscroll.js \
  ${PUBLIC_JS_DIR}bootstrap-tooltip.js

JS_LOGIN_SRC = \
  ${PUBLIC_JS_DIR}popuplib.js \
  ${PUBLIC_JS_LIB_DIR}openid-selector/js/openid-jquery.js \
  ${PUBLIC_JS_LIB_DIR}openid-selector/js/openid-en.js

JS_TOUCH_SRC = \
  ${JS_COMMON_SRC} \
  ${PUBLIC_JS_DIR}debiki.js

# For now, don't include JS_LOGIN_SRC. I'll load those files one at a time,
# so I don't have to rewrite that much Javascript right now.
JS_DESKTOP_SRC = \
  ${JS_COMMON_SRC} \
  ${JS_DESKTOP_ONLY_SRC} \
  ${PUBLIC_JS_DIR}debiki.js

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



.PHONY: cleanjs

# vim: list
