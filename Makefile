# E.g.  make watch what=target
watch:
	while true; do \
	  make $(what); \
	  inotifywait -qre close_write . ; \
	done

.PHONY: \
  clean \
  build-images \
  sbt \
  up \
  down \
  dead \
  selenium-server \
  invisible-selenium-server \
  git-subm-init-upd \
  minified-asset-bundles \
  play-framework-package \
  prod-images




# ----- Git submodules

# This'll be all Git submodule directories. If some are missing, need to git-clone them.
git_modules:=$(shell grep submodule .gitmodules | sed -r 's/^.submodule "([^"]+).*$$/\1/')

git-subm-init-upd: $(git_modules)

$(git_modules): $@
	git submodule update --init



# ----- Javascript and CSS bundles

# If these are present, probably all js modules have been installed?
node_modules: \
			node_modules/.bin/gulp
			#node_modules/react/umd/react.development.js \
			#node_modules/zxcvbn/dist/zxcvbn.js

node_modules/.bin/gulp:
	sudo s/d run --rm gulp yarn

# BUG RISK sync with Gulp so won't accidentally forget to (re)build?
# Sync with the languages in the /translations/ dir. [5JUKQR2]
zipped_bundles:=\
  public/res/2d-bundle.min.js.gz \
  public/res/ed-comments.min.js.gz \
  public/res/editor-bundle.min.js.gz \
  public/res/jquery-bundle.min.js.gz \
  public/res/more-bundle.min.js.gz \
  public/res/server-bundle.min.js.gz \
  public/res/slim-bundle.min.js.gz \
  public/res/staff-bundle.min.js.gz \
  public/res/styles-bundle.min.css.gz \
  public/res/talkyard-service-worker.min.js.gz \
  public/res/zxcvbn.min.js.gz \
  public/res/translations/en_US/i18n.min.js.gz \
  public/res/translations/pl_PL/i18n.min.js.gz

minified-asset-bundles: node_modules $(zipped_bundles)

$(zipped_bundles): $@
	sudo s/d-gulp release



# ----- Clean (wip)

clean:
	rm -f $(zipped_bundles) \
	rm -fr public/res/translations \
	rm -fr target



# ----- Run targets

# Starts an SBT shell where you can run unit tests by typing 'test'. These test require
# the minified asset bundles, to run (because the app server loads and execs React Javascript
# server side.)
sbt: minified-asset-bundles
	sudo s/d-cli

up: minified-asset-bundles
	sudo s/d-up-d-logsf0

down:
	sudo s/d down

dead:
	sudo s/d-killdown


# ----- E2E tests

selenium-standalone := \
			node_modules/selenium-standalone/bin/selenium-standalone  \
			node_modules/selenium-standalone/.selenium/chromedriver/2.41-x64-chromedriver \
			node_modules/selenium-standalone/.selenium/geckodriver/0.20.1-x64-geckodriver

$(selenium-standalone): $@
	s/selenium-install

selenium_line := $(shell netstat -tlpn | grep '4444')

selenium-server-ifeq-bad: $(selenium-standalone)
ifeq ($(selenium_line),)
	selenium_line=`netstat -tlpn | grep '4444'` \
	echo $$selenium_line \
	if [ -z "xx $$selenium_line" ]; then \
	  s/selenium-start ; \
	fi
endif


selenium-server: $(selenium-standalone)
	echo ;\
	selenium_line=`netstat -tlpn 2>&1 | grep '4444'` ;\
	if [ -z "x $$selenium_line" ]; then \
	  echo "Starting Selenium, in visible mode." ;\
	  s/selenium-start ;\
	else \
	  echo "Selenium already running. Not starting it." ;\
	  echo "Look, from netstat, port 4444 is in use:" ;\
	  echo "  $$selenium_line" ;\
	fi


invisible-selenium-server: $(selenium-standalone)
ifeq ($(selenium_line),)
	s/selenium-start-invisible
endif




# ----- Images (wip)


apa:
	REPO=`sed -nr 's/DOCKER_REPOSITORY=([a-zA-Z0-9\._-]*).*/\1/p' .env` ;\
	echo $$REPO ;\
	if [ -z "$$REPO" ]; then \
	  echo "EMPTY: $$REPO" ;\
	else \
	  echo "DEFIND: $$REPO" ;\
	fi


# Not like this. Need to run like in  build-and-release.sh
prod-images: \
			invisible-selenium-server
	sudo s/d build \
	\
	# Optimize assets, run unit & integration tests and build the Play Framework image
	# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
	sudo s/d-gulp release \
	\
	# Delete unminified files, so Docker diffs a few MB smaller.
	find public/res/ -type f -name '*\.js' -not -name '*\.min\.js' -not -name 'ed-comments\.js' -not -name 'zxcvbn\.js' | xargs rm \
	find public/res/ -type f -name '*\.css' -not -name '*\.min\.css' | xargs rm \
	# COULD add tests that verifies the wrong css & js haven't been deleted?
	\
	# Test and build prod dist of the Play app. Do this one at a time, or out-of-memory:
	sudo s/d-cli clean compile \
	sudo s/d-cli test dist \
	\
	sudo s/d kill web app \
	sudo s/d down \
	\
	# Build app image that uses the production version of the app, built with 'dist' above:
	sudo docker/build-app-prod.sh



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



# vim: list ts=4 sw=4 tw=0 fo=r