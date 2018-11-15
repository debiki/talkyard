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
  docker-images




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


play-framework-package:
	sudo s/d-cli dist


# ----- Clean (wip)

clean:
	rm -f $(zipped_bundles) \
	rm -fr public/res/translations \
	rm -fr target



# ----- Production images (wip)

docker-images: \
		minified-asset-bundles \
		play-framework-package
	sudo s/d build


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

selenium-server: $(selenium-standalone)
	s/selenium-start

invisible-selenium-server: $(selenium-standalone)
	s/selenium-start-invisible



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