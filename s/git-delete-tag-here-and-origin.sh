#!/bin/bash

# Exit on error.
set -e

tag_name="$1"

git tag --delete "$tag_name"
git push origin ":refs/tags/$tag_name"


