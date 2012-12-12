# This makefile is called two times by SBT;
# Once to compile_javascript to Java bytecode.
# And once to combine_and_gzip_javascript.

DESTDIR=target/scala-2.10/compiledjs-classes/
CLASSDIR=${DESTDIR}compiledjs/
HTML_SANITIZER_JS=client/vendor/html-sanitizer-bundle.js
SHOWDOWN_JS=public/res/wmd/showdown.js
RHINOJAR=/mnt/data/dev/play/github/repository/cache/rhino/js/jars/js-1.7R2.jar

SBT_CLASSDIR_ROOT=target/scala-2.10/classes/

help:
	@echo Open the Makefile and read it.

# Compile Javascript to Java bytecode, using Mozilla Rhino.
# There're some duplicated rules unfortunately.

compile_javascript: \
		${CLASSDIR}HtmlSanitizerJsImpl.class \
		${CLASSDIR}ShowdownJsImpl.class \
		silly_copy_to_sbt_classdir

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


silly_copy_to_sbt_classdir: \
		${CLASSDIR}HtmlSanitizerJsImpl.class \
		${CLASSDIR}ShowdownJsImpl.class
	cp -a ${DESTDIR}compiledjs ${SBT_CLASSDIR_ROOT}


cleanjs:
	rm -f ${CLASSDIR}ShowdownJs.class ${CLASSDIR}HtmlSanitizerJs.class
	rm -f ${CLASSDIR}ShowdownJsImpl.class ${CLASSDIR}HtmlSanitizerJsImpl.class
	rm -f ${CLASSDIR}ShowdownJsImpl1.class ${CLASSDIR}HtmlSanitizerJsImpl1.class


clean: cleanjs

.PHONY: cleanjs clean

# vim: list
