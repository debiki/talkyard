# GNU Make tips:
# Variables:
#   $@  The file name of the target of the rule


# E.g.  make watch what=target
watch:
	while true; do \
	  make $(what); \
	  inotifywait -qre close_write . ; \
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
  play-cli

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
  images/app/assets/translations/en_US/i18n.js \
  images/app/assets/translations/en_US/i18n.min.js \
  images/app/assets/translations/he_IL/i18n.js \
  images/app/assets/translations/he_IL/i18n.min.js \
  images/app/assets/translations/pl_PL/i18n.js \
  images/app/assets/translations/pl_PL/i18n.min.js

# Sync this task name w e2e test [MKBUNDLS].
prod_asset_bundles: node_modules debug_asset_bundles $(prod_asset_bundle_files)

$(prod_asset_bundle_files): $@
	s/d-gulp build_release_dont_clean_before


# Use .js.gz, because .js files get deleted (aren't needed). [UNCOMPRAST]
# Except for the server bundle — it loads non-gz scripts.
debug_asset_bundles_files: \
  images/app/assets/server-bundle.js \
  images/web/assets/talkyard-comments.js.gz \
  images/web/assets/talkyard-service-worker.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/editor-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/more-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/slim-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/staff-bundle.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/zxcvbn.js.gz \
  images/web/assets/$(TALKYARD_VERSION)/styles-bundle.css.gz


images/app/assets/server-bundle.js: \
       $(shell find client/server/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileServerTypescriptConcatJavascript

images/web/assets/talkyard-comments.js.gz: \
       $(shell find client/embedded-comments/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileBlogCommentsTypescript-concatScripts

images/web/assets/talkyard-service-worker.js.gz: \
       $(shell find client/serviceworker/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileSwTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/editor-bundle.js.gz: \
       $(shell find client/app-editor/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileEditorTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/more-bundle.js.gz: \
       $(shell find client/app-more/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileMoreTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/slim-bundle.js.gz: \
       $(shell find client/app-slim/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileSlimTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/staff-bundle.js.gz: \
       $(shell find client/app-staff/ -type f  \(  -name '*.ts'  -o  -name '*.js'  \))
	@echo "Regenerating $@"
	s/d-gulp  compileStaffTypescript-concatScripts

images/web/assets/$(TALKYARD_VERSION)/zxcvbn.js.gz: \
       node_modules/zxcvbn/dist/zxcvbn.js
	@echo "Bundling $@"
	s/d-gulp  bundleZxcvbn

images/web/assets/$(TALKYARD_VERSION)/styles-bundle.css.gz: \
       $(shell  find client/  -type f  \(  -name '*.styl'  -o  -name '*.css'  \)  )
	@echo "Regenerating $@"
	s/d-gulp  compile-stylus


debug_asset_bundles: debug_asset_bundles_files


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
	@echo "    rm -fr node_modules/"
	@echo "    rm -fr modules/*/node_modules/"
	@echo
	@echo "    rm -fr images/app/typesafe-activator"
	@echo
	@echo "  No, old, now in vendors/jars/:"
	@echo "    rm -fr ~/.ivy2"
	@echo "    rm -fr ~/.sbt"
	@echo
	@echo


# ----- Development


build:
	@echo "Build what, dev or prod images? Do one of these:"
	@echo "   make dev-images"
	@echo "   make prod-images"


# Copy to inside the Docker build context, so Docker can access it. [ACTVTRJAR]
# Use rsync so will update any old but different files with the same name.
_copy_typesafe_activator:
	@rsync --delete --recursive vendors/jars/typesafe-activator images/app/


# (About prod_asset_bundles: What was the reason the prod bundles are needed here?
# It's that the app server wants minified translation files? —  see play-cli  below)
dev-images:  prod_asset_bundles  _copy_typesafe_activator
	s/d build


# Starts an SBT shell where you can run unit tests by typing 'test'. These test require
# the minified asset bundles, to run (because the app server loads and execs React Javascript
# server side.)
play-cli: prod_asset_bundles _copy_typesafe_activator
	s/d-cli


db-cli:
	@# Find out which database is currently being used, by looking at my.conf.
	@# Because I sometimes connect as the wrong user, and feel confused for quite a while.
	@def_user=`sed -nr 's/^talkyard.postgresql.user="([a-zA-Z0-9\._-]+)".*/\1/p' conf/my.conf`  ;\
	  def_user="$${def_user:-talkyard}" ;\
	  read -p "Connect to the PostgreSQL database as which user? [$$def_user] " db_user ;\
	  db_user="$${db_user:-$$def_user}" ;\
	  s/d-psql "$$db_user" "$$db_user"


up: prod_asset_bundles _copy_typesafe_activator
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

restart:  prod_asset_bundles
	s/d-restart


restart-web:
	s/d kill web ; s/d start web ; s/d-logsf0

recreate-web:
	s/d kill web ; s/d rm -f web ; s/d up -d web ; s/d-logsf0

rebuild-restart-web:
	s/d kill web ; s/d rm -f web ; s/d build web ; s/d up -d web ; s/d-logsf0


rebuild-gulp:
	s/d kill gulp ; s/d rm -f gulp ; s/d build gulp

rebuild-restart-gulp: rebuild-gulp
	 s/d up -d gulp ; s/d-logsf0 gulp

restart-gulp:
	s/d kill gulp ; s/d start gulp ; s/d-logsf0


restart-app:  prod_asset_bundles
	s/d kill app ; s/d start app ; s/d-logsf0

recreate-app:  _copy_typesafe_activator  prod_asset_bundles
	s/d kill app ; s/d rm -f app ; s/d up -d app ; s/d-logsf0

rebuild-app:  _copy_typesafe_activator  prod_asset_bundles
	s/d kill app ; s/d rm -f app ; s/d build app

rebuild-restart-app:  rebuild-app
	 s/d up -d app ; s/d-logsf0

dead-app:
	s/d kill web app


restart-web-app:  prod_asset_bundles
	s/d-restart-web-app


down: dead
	s/d down

dead:
	@# Kill the ones who are slow to stop.
	s/d kill app search gulp ; s/d stop



# Prod images
# ========================================


# Any old lingering prod build project, causes netw pool ip addr overlap error.
_kill_old_prod_build_project:
	s/d -pedt kill web app search cache rdb ;\
	s/d -pedt down


prod-images:  _kill_old_prod_build_project  _copy_typesafe_activator
	@# This cleans and builds prod_asset_bundles. [PRODBNDLS]
	s/build-prod-images.sh


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
