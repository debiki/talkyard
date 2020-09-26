#!/bin/bash

set -e  # exit on error

# For files and memory, typically Mebibyte = 1024 * 1024 is used,
# instead of Megabyte = 1000 * 1000.  [kibi_fs_ram]
mebibytes="$1"

if [ -z "$1" ] || [ -n "$2" ]; then
  echo 'Usage: s/gen-large-file.sh 2'
  echo
  echo 'That generates this file:  target/bigfile-2mib.zeros,'
  echo '2 Mebibytes large.'
  echo
  exit 1
fi


if ! [[ $mebibytes =~ ^([0-9]+\.)?[0-9]+$ ]] ; then
  echo "Error, not a positive number:  $mebibytes"
  exit 1
fi

int_meb=$( echo "$mebibytes" | sed 's/\..*//')

if [ $int_meb -gt 100 ]; then
  echo "I don't want to generate files > 100 MiB. Error. Bye."
  exit 1
fi


# 'sed' removes decimals, so we'll get an integer number of kibibytes,
# if $mebibytes is a decimal number.

count=$( echo "$mebibytes * 1024" | bc | sed 's/\..*$//' )

# Sync w e2e test [bigf_file_names].
out_file="target/bigfile-${mebibytes}mib.zeros"

if [ -f "$out_file" ]; then
  echo "File already exists:  $out_file"
  echo "Fine, I'll do nothing, bye."
  exit 0
fi

# Without  of=...,  would write to stdout.
dd if=/dev/zero  count=$count bs=1024  of=$out_file
