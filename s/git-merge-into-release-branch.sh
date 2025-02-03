#!/bin/bash

# Finds out if the next version number, in file ./version.txt,
# makes sense — or if it's too old (too low), something is amiss.


set -e  # exit on error

dbg="f"

cur_branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$cur_branch" != 'main' ]; then
  echo "Current branch should be 'main'"
  exit 1
fi

versions_file='modules/ed-versions/version-tags.log'
old_versions=$(cat $versions_file)
next_version=$(cat version.txt)
old_and_next_vs=$(echo "$old_versions
$next_version")

# 'sed' removes space padding before the count number.
dupls_old_next_vs=$(echo "$old_and_next_vs" | sort -V | uniq -c | sed 's/^ *//')
dupls_most_recent=$(echo "$dupls_old_next_vs" | tail -n1)

if [ "$dbg" = "t" ]; then
  echo "next: $next_version"
  echo "old_and_next_vs: $old_and_next_vs"
  echo "dupls_old_next_vs: $dupls_old_next_vs"
  echo "dupls_most_recent: $dupls_most_recent"
fi

year="$(date +%Y)"
if [[ ! $next_version =~ ^v0\.$year\. ]]; then
  echo
  echo "Wrong year in version number, should be $year:  $next_version"
  echo
  echo "Edit  version.txt — bump the year, and reset the in-year version to 001."
  echo
  echo "And, don't forget to bump the GPLv2 change dates"
  echo "in  README.md,  and the copyright-up-to year too."
  echo "(4 edits in total, in 2 files.)"
  echo
  exit 1
fi

if [ "$dupls_most_recent" == "2 $next_version" ]; then
  echo
  echo "Bad version in version.txt:  $next_version"
  echo
  echo "That's the same as the most recent version number in $versions_file,"
  echo "indicating that this version has been released already?"
  echo
  exit 1
fi

if [ "$dupls_most_recent" != "1 $next_version" ]; then
  echo
  echo "Bad version in version.txt:  $next_version"
  echo
  echo "That's not the most recent version number — seems there's"
  echo "a higher version number in $versions_file:"
  echo "  $dupls_most_recent"
  echo
  exit 1
fi

if [ -n "$(git status -s)" ]; then
  echo
  echo
  echo "Error: There're changes or untracked files, look, git status:"
  echo
  git status
  echo
  exit 1
fi

# dupl code [bashutils]
echo 
read -p "Merge $next_version into the release branch? [y/n]?  " choice
case "$choice" in 
  y|Y|yes|Yes|YES ) echo "Ok, will do:"; echo ;;
  n|N|no|No|NO ) echo "Ok, doing nothing, bye."; exit 1;;
  * ) echo "What? Bye."; exit 1;;
esac


echo
echo "Run these commands, that's all:  (do manually, for now)"
echo

echo git checkout release
echo git merge --no-ff main -m "\"Merge $next_version into 'release'.\""
echo 'git branch -f main release'
echo 'git branch -f master main  # backw compat'
