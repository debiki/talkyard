
# E.g.  make watch what=target
watch:
	while true; do \
	  make $(what); \
	  inotifywait -qre close_write . ; \
	done

.PHONY: \
  clean \
  build-images \
  up \
  down \
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

# BUG RISK sync with Gulp so won't accidentally forget to (re)build?
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
  public/res/ty-service-worker.min.js.gz \
  public/res/zxcvbn.min.js.gz

minified-asset-bundles: $(zipped_bundles)

$(zipped_bundles): $@
	sudo s/d-gulp release


play-framework-package:
	sudo s/d-cli dist


# ----- Clean (wip)

clean:
	rm $(zipped_bundles)



# ----- Production images (wip)

docker-images: \
		minified-asset-bundles \
		play-framework-package
	sudo s/d build




#https://gist.github.com/mpneuried/0594963ad38e68917ef189b4e6a269db
# DOCKER_REPO=...

#modules/ed-prod-one-test \
#modules/ed-versions/version-tags.log: $@
#	git submodule update --init




up:
	sudo s/d up -d

down:
	sudo s/d down






# http://datakurre.pandala.org/2016/04/evolution-of-our-makefile-for-docker.html
# capture test status code:
test: DOCKER_RUN_ARGS = --volumes-from=$(BUILD)
test: bin/test
	$(INIT_CACHE)
	$(call make,test); \
	  status=$$?; \
	  docker cp $(BUILD):/build .; \
	  docker rm -f -v $(BUILD); \
	  exit $$status


# https://serversforhackers.com/c/dckr-dev-workflow
log:
	tail -f $(PWD)storage/logs/laravel.log | awk '\
	    {matched=0}\
	    /INFO:/    {matched=1; print "\033[0;37m" $$0 "\033[0m"}\
	    /WARNING:/ {matched=1; print "\033[0;34m" $$0 "\033[0m"}\
	    /ERROR:/   {matched=1; print "\033[0;31m" $$0 "\033[0m"}\
	    /Next/     {matched=1; print "\033[0;31m" $$0 "\033[0m"}\
	    /ALERT:/   {matched=1; print "\033[0;35m" $$0 "\033[0m"}\
	    /Stack trace:/ {matched=1; print "\033[0;35m" $$0 "\033[0m"}\
	    matched==0            {print "\033[0;33m" $$0 "\033[0m"}\


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
