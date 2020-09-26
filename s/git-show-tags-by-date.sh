#!/bin/bash

# Prints tags, rows like:
#
# 2020-08-23 09:46:31 +0200 2c26eb4  (tag: cr-done-4765762)
#

git log --date-order --tags --graph --simplify-by-decoration --pretty=format:'%ai %h %d'


