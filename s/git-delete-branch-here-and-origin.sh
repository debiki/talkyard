#!/bin/bash

# Exit on error.
set -e

branch_name="$1"

git branch -D "$branch_name"
git push origin --delete "$branch_name"


