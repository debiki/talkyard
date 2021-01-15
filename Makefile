# GNU Make tips:
# Variables:
#   $@  The file name of the target of the rule


# This needs:  apt install inotify-tools
# Background?:
#	@(echo "bg cmd" ; (echo "bg_cmd exited, status: $$?")) &  backsl
# But then continues running also after other foreground target completed.
#
# Supposedly works on Mac:
#   brew install fswatch
# and instead of the inotifywait line:
#   fswatch -1 .
# or?:  Nodejs nodemon?
# see: https://stackoverflow.com/a/23734495
#
# Listening to modify, delete, move, create seems better than  close_write?
# close_write doesn't necessarily mean the file was modified.
#
# Have inotifywait exit after a few seconds, because otherwise it tends to stay
# alive forever, after the parent 'while true; do ...' has
# exited.
# Hmm! But then  make  runs again and logs annoying messages. Skip: --timeout 3
#
watch: watch-debug_asset_bundles
watch-debug_asset_bundles:
	while true; do \
	  inotifywait -q -r -e modify -e create -e delete -e move \
	        client package.json ;\
	  make debug_asset_bundles ;\
	done

# E.g.  make watch what=target
watch-what:
	while true; do \
	  make $(what); \
	  inotifywait -qre close_write . ;\
	done

.PHONY: \
  clean \
  dev-images \
  prod-images \
  build \
  up \
  down \
  dead \
  prod_asset_bundles \
  prod_asset_bundle_files \
  debug_asset_bundles \
  debug_asset_bundles_files \
  git-subm-init-upd \
  node_modules \
  play-cli \
  watch \
  watch-debug_asset_bundles

.DEFAULT_GOAL := print_help

print_help:
	@echo
	@echo "This is Talkyard's Makefile."
	@echo
	@echo "(How do you debug a Makefile, when it does weird things?"
	@echo "Like so:   make -nd the_target    e.g.:  make -nd up"
	@echo "And to show only interesting things like commands: (not indented)"
	@echo "make -nd  debug_asset_bundles | grep -v 'older than' | egrep -i -C2 '^[^ ]|newer than|does not exist|must remake'"
	@echo ")"
	@echo
	@echo "Usage:"
	@echo
	@echo "Building production images"
	@echo "--------------------------"
	@echo
	@echo "Edit version.txt and commit. Edit DOCKER_REPOSITORY in .env."
	@echo "Then:"
	@echo
	@echo "  Build production images:  make prod-images"
	@echo "  Push to your repo:        make tag-and-push-latest-images"
	@echo
	@echo "Running a development server"
	@echo "--------------------------"
	@echo
	@echo "  Start a dev server:       make up"
	@echo "  Stop the dev server:      make dead"
	@echo "  View logs:                make logs"
	@echo
	@echo "  Open PostgreSQL prompt:   make db-cli"
	@echo
	@echo "  Start a Scala CLI:        make dead-app ; make play-cli"
	@echo
	@echo "Running tests"
	@echo "--------------------------"
	@echo
	@echo "End-to-End tests:"
	@echo "  Start Talkyard:           make up
	@echo "  Start Selenium:           d/selenium chrome"
	@echo "  Run the tests:            s/run-e2e-tests   # or:  d/n s/run-e2e-tests ?"
	@echo "  Stop Selenium:            d/selenium kill"
	@echo
	@echo "Unit tests:"
	@echo "  Stop the app server:      make dead-app"
	@echo "  Start a Scala CLI:        make play-cli"
	@echo "  Run tests:                test  # in the CLI"
	@echo
	@echo "What more do you want to know? Talk with us at"
	@echo "https://www.talkyard.io/forum/."
	@echo


DOCKER_REPOSITORY := \
  $(shell sed -nr 's/DOCKER_REPOSITORY=([a-zA-Z0-9\._-]*).*/\1/p' .env)

TALKYARD_VERSION := \
  $(shell cat version.txt)

define ask_for_root_password
  sudo echo
endef



# ----- Git submodules

# This'll be all Git submodule directories. If some are missing, need to git-clone them.
git_modules := \
  $(shell grep submodule .gitmodules | egrep -v '^ *\#' | sed -r 's/^.submodule "([^"]+).*$$/\1\/.git/')

git-subm-init-upd: $(git_modules)

$(git_modules): $@
	git submodule update --init



# ----- Javascript and CSS bundles


# If these are present, probably all js modules have been installed?
node_modules: \
            node_modules/.bin/gulp
            #node_modules/react/umd/react.development.js \
            #node_modules/zxcvbn/dist/zxcvbn.js

node_modules/.bin/gulp: git-subm-init-upd
	s/yarn

# BUG RISK sync with Gulp so won't accidentally forget to (re)build? [GZPATHS]
# Sync with the languages in the /translations/ dir. [5JUKQR2]
#  public/res/2d-bundle.min.js.gz // [SLIMTYPE]
prod_asset_bundle_files:=\
  images/web/assets/talkyard-comments.min.js.gz \
  images/web/assets/talkyard-service-worker.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/editor-bundle.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/more-bundle.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/slim-bundle.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/staff-bundle.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/styles-bundle.min.css.gz \
  images/web/assets/$(TALKYARD_VERSION)/styles-bundle.rtl.css.gz \
  images/web/assets/$(TALKYARD_VERSION)/styles-bundle.rtl.min.css.gz \
  images/web/assets/$(TALKYARD_VERSION)/zxcvbn.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/en_US/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/en_US/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/es_CL/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/es_CL/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/he_IL/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/he_IL/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/lv_LV/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/lv_LV/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/pl_PL/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/pl_PL/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/pt_BR/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/pt_BR/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/ru_RU/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/ru_RU/i18n.min.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/sv_SE/i18n.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/translations/sv_SE/i18n.min.js.gz \
  images/app/assets/server-bundle.min.js \
  images/app/assets/translations/en_US/i18n.min.js \
  images/app/assets/translations/es_CL/i18n.min.js \
  images/app/assets/translations/he_IL/i18n.min.js \
  images/app/assets/translations/pl_PL/i18n.min.js

# Sync this task name w e2e test [MKBUNDLS].
prod_asset_bundles: debug_asset_bundles $(prod_asset_bundle_files)

$(prod_asset_bundle_files): $@
	s/d-gulp build_release_dont_clean_before


# Use .js.gz, because .js files get deleted (aren't needed). [UNCOMPRAST]
# Except for the server bundle — it loads non-gz scripts.
debug_asset_bundles_files: \
  images/app/assets/server-bundle.js \
  images/web/assets/talkyard-comments.js.gz \
  images/web/assets/talkyard-service-worker.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/editor-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/head-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/more-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/slim-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/staff-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/zxcvbn.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/styles-bundle.css.gz



# Most files in client/app-slim are softlinked from client/server/*,
# so regenerate bundle also if any app-slim file changes. Plus some
# specific third-party and node_modules files.
#
# Sync with gulpfile.ts [srv_js_files]  — if this list gets out of sync,
# Prod builds will still work fine since they clean and rebuild-all,
# but Dev builds might get a messed up server side bundle, causing React.js
# hydration errors, making "impossible" things happen and break in the browser.
#
# It's annoying to have too keep things in sync between here and gulpfile.js
# — what are some better alternatives?
#
# Doesn't work:  $(shell find client/{app-slim,server}/   — so 2 lines instead.
#
images/app/assets/server-bundle.js: \
       $(shell find client/app-slim/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       $(shell find client/server/   -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       modules/sanitize-html/dist/sanitize-html.min.js \
       client/third-party/html-css-sanitizer-bundle.js \
       node_modules/react/umd/react.production.min.js \
       node_modules/react-dom/umd/react-dom-server.browser.production.min.js \
       node_modules/react-dom-factories/index.js \
       node_modules/create-react-class/create-react-class.min.js \
       node_modules/react-router-dom/umd/react-router-dom.min.js \
       client/third-party/tiny-querystring.umd.js \
       node_modules/markdown-it/dist/markdown-it.min.js \
       client/third-party/lodash-custom.js \
       client/third-party/non-angular-slugify.js \
       client/app-editor/editor/mentions-markdown-it-plugin.ts \
       client/app-editor/editor/link-previews-markdown-it-plugin.editor.ts
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileServerTypescriptConcatJavascript


# Sync w gulpfile.js [embcmts_js_files]
images/web/assets/talkyard-comments.js.gz: \
       $(shell find client/embedded-comments/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       client/third-party/bliss.shy.js \
       client/third-party/smoothscroll-tiny.js \
       client/app-slim/utils/calcScrollRectIntoViewCoords.js
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileBlogCommentsTypescript-concatScripts


# Sync w gulpfile.js. [sw_js_files]
images/web/assets/talkyard-service-worker.js.gz: \
       $(shell find client/serviceworker/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileSwTypescript-concatScripts


# Sync w gulpfile.js. [edr_js_files]
images/web/assets/$(TALKYARD_VERSION)/editor-bundle.js.gz: \
       $(shell find client/app-editor/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       modules/sanitize-html/dist/sanitize-html.js \
       client/third-party/html-css-sanitizer-bundle.js \
       node_modules/markdown-it/dist/markdown-it.js \
       node_modules/blacklist/dist/blacklist.js \
       node_modules/fileapi/dist/FileAPI.html5.js \
       node_modules/@webscopeio/react-textarea-autocomplete/dist/react-textarea-autocomplete.umd.min.js \
       client/third-party/diff_match_patch.js \
       client/third-party/non-angular-slugify.js
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileEditorTypescript-concatScripts


# Sync w gulpfile.js. [head_js_files]
images/web/assets/$(TALKYARD_VERSION)/head-bundle.js.gz: \
       $(shell find client/app-head/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileHeadTypescript-concatScripts


# Sync with gulpfile.ts [more_js_files].
images/web/assets/$(TALKYARD_VERSION)/more-bundle.js.gz: \
       $(shell find client/app-more/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       node_modules/react-bootstrap/dist/react-bootstrap.js \
       node_modules/classnames/index.js \
       node_modules/react-input-autosize/dist/react-input-autosize.js \
       node_modules/react-select/dist/react-select.js \
       node_modules/moment/min/moment.min.js
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileMoreTypescript-concatScripts


# Sync with gulpfile.ts [slim_js_files].
images/web/assets/$(TALKYARD_VERSION)/slim-bundle.js.gz: \
       $(shell find client/app-slim/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \)) \
       node_modules/react/umd/react.development.js \
       node_modules/react-dom/umd/react-dom.development.js \
       node_modules/prop-types/prop-types.js \
       node_modules/create-react-class/create-react-class.js \
       node_modules/react-router-dom/umd/react-router-dom.js \
       node_modules/react-dom-factories/index.js \
       client/third-party/smoothscroll-tiny.js \
       client/third-party/bliss.shy.js \
       node_modules/keymaster/keymaster.js \
       client/third-party/rename-key-to-keymaster.js \
       client/third-party/lodash-custom.js \
       node_modules/eventemitter3/umd/eventemitter3.min.js \
       client/third-party/tiny-querystring.umd.js \
       client/third-party/gifffer/gifffer.js \
       client/third-party/get-set-cookie.js \
       client/third-party/popuplib.js
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileSlimTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/staff-bundle.js.gz: \
       $(shell find client/app-staff/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compileStaffTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/zxcvbn.js.gz: \
       node_modules/zxcvbn/dist/zxcvbn.js
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  bundleZxcvbn

images/web/assets/$(TALKYARD_VERSION)/styles-bundle.css.gz: \
       $(shell  find client/  -type f  \(  -name '*.styl'  -o  -name '*.css'  \)  )
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  compile-stylus


# ----- ext-iframe.js

# Skip minify, for now.
ext_iframe_js: \
        images/web/assets/ext-iframe.min.js \
        images/web/assets/ext-iframe.min.js.gz \
        images/web/assets/ext-iframe.js.gz

images/web/assets/ext-iframe.min.js: client/ext-iframe.js
	@cp      client/ext-iframe.js   images/web/assets/ext-iframe.min.js

images/web/assets/ext-iframe.min.js.gz: client/ext-iframe.js
	@gzip -c client/ext-iframe.js > images/web/assets/ext-iframe.min.js.gz

images/web/assets/ext-iframe.js.gz: client/ext-iframe.js
	@gzip -c client/ext-iframe.js > images/web/assets/ext-iframe.js.gz


# ----- Translations

# For Play Framework, the app container.
# E.g.:  images/app/assets/translations/en_US/i18n.js  etc.
transl_dev_app_bundle_files := \
  ${shell find translations/ -name '*.ts' | sed -nr 's;(.*)\.ts;images/app/assets/\1.js;p'}

# For Nginx, the web container — includes the version number, for asset versioning.
# E.g. images/web/assets/v0.2020.25/translations/en_US/i18n.js
transl_dev_web_bundle_files := \
  ${shell find translations/ -name '*.ts' | sed -nr 's;(.*)\.ts;images/web/assets/$(TALKYARD_VERSION)/\1.js;p'}

$(transl_dev_app_bundle_files) $(transl_dev_web_bundle_files): \
        ${shell find translations/ -name '*.ts'}
	@echo "Generating translation files: Transpiling .ts to .js"
	s/d-gulp  buildTranslations

transl_dev_bundles: ${transl_dev_web_bundle_files} ${transl_dev_app_bundle_files}


# ----- Fonts

# Sync 'open-sans-v1' with gulpfile.js and images/web/Dockerfile. [sync_fonts]

fonts: images/web/fonts/open-sans-v2/open-sans.min.css.gz

images/web/fonts/open-sans-v2/open-sans.min.css.gz:
	@echo "\nRegenerating: $@ ..."
	s/d-gulp  bundleFonts



debug_asset_bundles: \
        node_modules \
        debug_asset_bundles_files  \
        fonts \
        ext_iframe_js \
        transl_dev_bundles




# ----- To-Talkyard Javascript

to-talkyard: to-talkyard/dist/to-talkyard/src/to-talkyard.js

to-talkyard/dist/to-talkyard/src/to-talkyard.js: $(shell find to-talkyard/src/)
	@echo "Building To-Talkyard ..."
	@cd to-talkyard ;\
	set -x ;\
	yarn ;\
	yarn build
	@echo "... Done building To-Talkyard."


# ----- Clean (wip)

clean_bundles:
	@echo Delting script and style bundles:
	s/d-gulp clean

clean: clean_bundles
	@# target/ sometimes includes files compilation-created and owned by root.
	@echo Delting Scala things and other things:
	@$(call ask_for_root_password)
	sudo rm -fr target/
	rm -fr project/target/
	rm -fr project/project/
	rm -fr logs/
	rm -f  ensime-langserver.log
	rm -f  chromedriver.log

pristine: clean
	@echo
	@echo "If you want to, also delete Docker volumes, your local config,"
	@echo "the SBT and Node.js cache, and IDE project files,"
	@echo "by copy-pasting (some of) this:"
	@echo
	@echo "    sudo rm -rf volumes/"
	@echo
	@echo "    rm -fr conf/my.conf"
	@echo
	@echo "    rm -fr .idea"
	@echo "    rm -fr .ensime"
	@echo "    rm -fr .ensime_cache/"
	@echo
	@echo "    rm -fr modules/*/node_modules/"
	@echo
	@echo


# ----- Development


build:
	@echo "Build what, dev or prod images? Do one of these:"
	@echo "   make dev-images"
	@echo "   make prod-images"


dev-images:  debug_asset_bundles
	s/d build


# Starts an SBT shell where you can run unit tests by typing 'test'.
play-cli: debug_asset_bundles dead-app
	s/d-cli

# Starts but uses prod assets bundles.
play-cli-prod: prod_asset_bundles dead-app
	IS_PROD_TEST=true s/d-cli


db-cli:
	@# Find out which database is currently being used, by looking at my.conf.
	@# Because I sometimes connect as the wrong user, and feel confused for quite a while.
	@def_user=`sed -nr 's/^talkyard.postgresql.user="([a-zA-Z0-9\._-]+)".*/\1/p' conf/my.conf`  ;\
	  def_user="$${def_user:-talkyard}" ;\
	  read -p "Connect to the PostgreSQL database as which user? [$$def_user] " db_user ;\
	  db_user="$${db_user:-$$def_user}" ;\
	  s/d-psql "$$db_user" "$$db_user"


up: debug_asset_bundles
	s/d up -d
	@echo
	@echo "Started. Now, tailing logs..."
	@echo
	@s/d-logsf0


log: tail
logs: tail
tails: tail
tail:
	s/d-logsf0

restart:  debug_asset_bundles
	s/d-restart


restart-web:
	s/d kill web ; s/d start web ; s/d-logsf0

recreate-web:
	s/d kill web ; s/d rm -f web ; s/d up -d web ; s/d-logsf0

rebuild-restart-web:
	s/d kill web ; s/d rm -f web ; s/d build web ; s/d up -d web ; s/d-logsf0


rebuild-nodejs:
	s/d kill nodejs ; s/d rm -f nodejs ; s/d build nodejs

#rebuild-restart-nodejs: rebuild-nodejs
#	 s/d up -d nodejs ; s/d-logsf0 nodejs
#
#restart-nodejs:
#	s/d kill nodejs ; s/d start nodejs ; s/d-logsf0


restart-app:  debug_asset_bundles
	s/d kill app ; s/d start app ; s/d-logsf0

recreate-app:  debug_asset_bundles
	s/d kill app ; s/d rm -f app ; s/d up -d app ; s/d-logsf0

rebuild-app:  debug_asset_bundles
	s/d kill app ; s/d rm -f app ; s/d build app

rebuild-restart-app:  rebuild-app
	 s/d up -d app ; s/d-logsf0

dead-app:
	s/d kill web app


restart-web-app:  debug_asset_bundles
	s/d-restart-web-app


down: dead
	s/d down

dead:
	@# Kill the ones who are slow to stop.
	s/d kill app search ; s/d stop



# Prod images
# ========================================


# Any old lingering prod build project, causes netw pool ip addr overlap error.
_kill_old_prod_build_project:
	s/d -pedt kill web app search cache rdb ;\
	s/d -pedt down


prod-images:  _kill_old_prod_build_project
	@# This cleans and builds prod_asset_bundles. [PRODBNDLS]
	s/build-prod-images.sh


prod-images-only-e2e-tests:  _kill_old_prod_build_project
	@# This runs the e2e tests only.
	s/build-prod-images.sh --skip-build


tag-and-push-latest-images:  \
       tag-latest-images  push-tagged-images  _print_push_git_tag_command


tag-latest-images:
	@$(call die_unless_tag_specified, Tag with)
	@$(call ask_for_root_password)
	set -e  ;\
	REPO=$(DOCKER_REPOSITORY)  ;\
	sudo docker tag $$REPO/talkyard-app $$REPO/talkyard-app:$(tag)  ;\
	sudo docker tag $$REPO/talkyard-web $$REPO/talkyard-web:$(tag)  ;\
	sudo docker tag $$REPO/talkyard-rdb $$REPO/talkyard-rdb:$(tag)  ;\
	sudo docker tag $$REPO/talkyard-cache $$REPO/talkyard-cache:$(tag)  ;\
	sudo docker tag $$REPO/talkyard-search $$REPO/talkyard-search:$(tag)  ;\
	sudo docker tag $$REPO/talkyard-certgen $$REPO/talkyard-certgen:$(tag)
	@echo


push-tagged-images:
	@$(call die_unless_tag_specified, Push)
	@$(call ask_for_root_password)
	set -e  ;\
	REPO=$(DOCKER_REPOSITORY)  ;\
	sudo docker push $$REPO/talkyard-app:$(tag)  ;\
	sudo docker push $$REPO/talkyard-web:$(tag)  ;\
	sudo docker push $$REPO/talkyard-rdb:$(tag)  ;\
	sudo docker push $$REPO/talkyard-cache:$(tag)  ;\
	sudo docker push $$REPO/talkyard-search:$(tag)  ;\
	sudo docker push $$REPO/talkyard-certgen:$(tag)
	@echo


_print_push_git_tag_command:
	@echo "Next:"
	@echo ""
	@echo "    make push-tag-to-git tag=$(tag)"
	@echo ""


push-tag-to-git:
	@$(call die_unless_tag_specified, Push) ;\
	
	@echo
	@echo "Publishing version tag $(tag) to GitHub..."
	 
	@set -e  ;\
	cd modules/ed-versions/  ;\
	git fetch  ;\
	git checkout master  ;\
	git merge --ff-only origin/master  ;\
	echo $(tag) >> version-tags.log  ;\
	git add version-tags.log  ;\
	git commit -m "Add $(tag)."  ;\
	git push origin master
	
	@echo ""
	@echo "Tagging the current Git revision with $(tag) ..."
	
	@git tag $(tag)
	@git push origin $(tag)
	
	@echo ""
	@echo "Done. Now, bump the version number:"
	@echo ""
	@echo "    s/bump-versions.sh"
	@echo "    git add version.txt modules/ed-versions"
	@echo '    git commit -m "Bump version to `cat version.txt`."'
	@echo ""


define die_unless_tag_specified
  if [ -z "$(tag)" ]; then \
    echo ;\
    echo "Error: $(1) which Docker image tag? Specify   tag=...  please."  ;\
    echo ;\
    exit 1  ;\
  fi
endef



# ----- Maybe read (again)?

#https://gist.github.com/mpneuried/0594963ad38e68917ef189b4e6a269db
# DOCKER_REPO=...

# http://datakurre.pandala.org/2016/04/evolution-of-our-makefile-for-docker.html
# capture test exit status code: ... see blog post


# https://serversforhackers.com/c/dckr-dev-workflow  — log messages


# maybe read:
# http://aegis.sourceforge.net/auug97.pdf

# has read:
# https://serversforhackers.com/c/dckr-dev-workflow


# probably well constructed:
#  https://github.com/PistonDevelopers/rust-empty/blob/master/Makefile
#  https://github.com/git/git/blob/master/Makefile

# Bazel? No? Then everyone incl I need to spend time learning how it works:
#  https://github.com/bazelbuild/rules_k8s  and need to install Java.


# looks nice:
#   https://github.com/casey/just



# vim: list ts=4 sw=4 tw=0 fo=r
