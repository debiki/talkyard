#!/bin/bash

# This is for comparing the changes introduced by two commits on
# different branches, so you'll know if they do the same things.
# NOT for comparing everything in those two different revisions
# — just the changes in those particular commits / patches.


# <(... $1) creates a file descriptor with the contents of commit $1
# — just the changes in that commit, i.e. that patch — and another file
# descriptor with $2, and compares the difference with Meld, a diff viewer.
#
meld <(git show "$1") <(git show "$2")

