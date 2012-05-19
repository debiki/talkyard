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
	javac $< -d ${DESTDIR}

ShowdownJs: ${CLASSDIR}ShowdownJs.class
${CLASSDIR}ShowdownJs.class: app/compiledjs/ShowdownJs.java
	javac $< -d ${DESTDIR}


cleanjs:
	rm -f ${CLASSDIR}ShowdownJs.class ${CLASSDIR}HtmlSanitizerJs.class
	rm -f ${CLASSDIR}ShowdownJsImpl.class ${CLASSDIR}HtmlSanitizerJsImpl.class
	rm -f ${CLASSDIR}ShowdownJsImpl1.class ${CLASSDIR}HtmlSanitizerJsImpl1.class

.PHONY: cleanjs

