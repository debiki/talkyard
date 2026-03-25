#!/bin/bash

function log_message {
  echo "`date --iso-8601=seconds --utc` delete-backups: $1"
}

echo
echo
log_message "Deleting old backups ..."

archives_dir=/var/opt/backups/talkyard/v1/archives
deleted_backups_log=./deleted-backups.tmp.log



# Delete old Postgres and config backups
# -------------------

function deleteSome {
  what_files="$1"

  run_find() {
    # (This: `-regextype posix-extended` must be before `-regex`.)
    find $archives_dir -type f -regextype posix-extended \
            -regex ".+/.+-$what_files(\.gpg)?"  "$@"
  }

  min_recent_bkps=8
  recent_days=10
  recent_bkp_paths=$(run_find -not -mtime +$recent_days)

  num_recent_bkps=0
  # Since _echo_prints_newline also if empty, first check if is empty.
  if [ -n "$recent_bkp_paths" ]; then
    num_recent_bkps=$(echo "$recent_bkp_paths" | wc --lines)
  fi

  # If new backups don't work (i.e. there are too few recent backups) or we haven't yet
  # been backing up for a while, then, delete nothing.
  # (Don't want to login to the server and notice that new backups haven't appeared,
  # and all old ones have been auto deleted.)
  #
  if [ "$num_recent_bkps" -lt "$min_recent_bkps" ]; then
    log_message "There're only $num_recent_bkps recent backups of type '$@' less"
    log_message "than $recent_days days old. That's few — maybe something is amiss?"
    log_message "I won't delete any old backups of that type."
    log_message "I see only these recent backups:"
    echo "$recent_bkp_paths"
    echo
  else
    # Delete all older than a year.
    run_find -mtime +366  \
        -print -delete >> $deleted_backups_log

    # Keep monthly backups, if older than 3 months.
    run_find -mtime +92  \
        -not -regex '.*[0-9]{4}-[0-9]{2}-01T.*' -print -delete >> $deleted_backups_log

    # Keep 1/10 days backups, if older than 1 month. (From the 1st, 11th and 21th days each month, but not 31st.)
    run_find -mtime +32  \
        -not -regex '.*[0-9]{4}-[0-9]{2}-[012]1T.*' -print -delete >> $deleted_backups_log

    # Keep 1/3 days backups, if older than _two_weeks.
    run_find -mtime +14  \
        -not -regex '.*[0-9]{4}-[0-9]{2}-[012][148]T.*' -print -delete >> $deleted_backups_log

    # For the last weeks, keep all backups. (Noop.)
  fi
}

deleteSome "postgres\.sql\.gz"
deleteSome "config\.tar\.gz"
deleteSome "random-value\.txt"  # (not gzipped)



# Delete old Redis backups
# -------------------

# Redis is a cache. No point in keeping backups for long, say, more than _two_weeks.

find $archives_dir -type f -mtime +14 -daystart -regextype posix-extended \
      -regex '.*/.*-redis\.rdb\.gz(\.gpg)?' -print -delete >> $deleted_backups_log



# Delete old uploads backups
# -------------------

# We create one archive directory for each month, and each such archive directory
# includes all uploads that existed at the start of the month, plus files uploaded
# during that month.
#
# Let's keep such archive dirs for 4 months = 4 archives (30.5 * 4 = 122 < 123).
# (These don't take much space — this month's backed up files are hard links to
# last month's backup. [hard_bkp_links])
#
# But if there're only 1 or 2 archives, then, don't delete anything — because
# that could mean something is amiss: new backups no longer appear.

find_upl_bkps () {
  find $archives_dir -name '*-uploads-up-to-incl-*.d' -type d  "$@"
}

recent_bkp_paths="$(find_upl_bkps -not -mtime +123)"
num_recent_bkps=0  # _echo_prints_newline
if [ -n "$recent_bkp_paths" ]; then
  num_recent_bkps=$(echo "$recent_bkp_paths" | wc --lines)
fi

if [ "$num_recent_bkps" -le "2" ]; then
  log_message "There're only $num_recent_bkps recent uploads backups."
  log_message "That's few — maybe something is amiss?"
  log_message "I won't delete any old uploads backups."
  log_message "I see only these uploads backups:"
  echo "$recent_bkp_paths"
  echo
else
  find_upl_bkps -mtime +123  \
      -print -prune -exec rm -rf '{}' +  \
      >> $deleted_backups_log
fi


# Show what was done
# -------------------

deleted_backups_str="$(cat $deleted_backups_log)"

if [ -z "$deleted_backups_str" ]
then
  log_message "No backups to delete."
else
  log_message "Deleted these backups:"
  echo "$deleted_backups_str"
  log_message "Done deleting backups."
fi
echo

rm $deleted_backups_log

