#!/bin/bash
# Runs `git status` in all Debiki's modules.

pushd . ; git status ; cd modules/debiki-core/ ; git status ; cd ../debiki-dao-pgsql ; git status ; cd ../debiki-tck-dao ; git status ; popd

