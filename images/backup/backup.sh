#!/bin/bash

# Backup approach: Dump the Postgres database, rsync-&-gzip all uploaded files, copy-&-gzip
# all config files and scripts. And gpg encrypt each file, if a password specified.
#
# Maybe can use sth like Restic, Rustic or BorgBackup in the future. Could add some
# flag to also backup using R[eu]stic, that is, double backups (both tar-gz and R[eu]stic)
# until everything is well tested.

# Tests, semi manual:
#   - modules/ed-prod-one-test/scripts/tests/test-generate-backups.sh
#   - modules/ed-prod-one-test/scripts/tests/test-delete-backups.sh

# Create backups with access perms 640, that is, root has write access,
# and the root group can read, no one else.
#
# (666 and 777 are the default new file and directory permissions, and zeroing the
# bits 027 leaves 640 and 750, that is, read-write for root, and read-only files & dirs
# for root group members.)
#
# We don't use 227 (removing write access for root) because maybe that'd cause
# problems if rsyncing big files.
#
umask 027  # [_backup_file_perms]

function log_message {
  echo "`date --iso-8601=seconds --utc` backup-script: $1"
}

if [ $# -ne 3 ]; then
  echo 'ERROR: Invalid arguments.'
  echo
  echo 'Usage: $0 backupLabel hostname date'
  echo 'where the date should be: `date '+%FT%H%MZ' --utc`.'

  echo 'E.g.: $0 someLabel "$(hostname)" "$(date '+%FT%H%MZ' --utc)"'
  echo
  echo 'Aborting. Bye'
  exit 1
fi

# Alternatively, pass params like so:
# docker compose run ...
#     -e HOST_HOSTNAME="$(hostname)" -e HOST_DATE="$(`date '+%FT%H%MZ' --utc`)"

label="$1"
# This'll be like:  '2025-03-17T2359Z'
when="$3"      # "${HOST_DATE:-$(date '+%FT%H%MZ' --utc)}"
hostname="$2"  # "${HOST_HOSTNAME:-unknownhost}"

encrypted=''
dot_gpg=''
backup_pwd_file='/run/secrets/backup_password'

# '-s' means file exists and is not empty.
if [ -s $backup_pwd_file ]; then
  encrypted=', encrypted,'
  dot_gpg='.gpg'
fi

log_message "Backing up '$hostname', when: '$when', tag: '$label'$encrypted ..."

gpg_encrypt="gpg --batch --symmetric --cipher-algo AES256 --passphrase-file $backup_pwd_file"


# Directories
# -------------------

# These dirs are mounted in docker-compose.yml  (see 'backup: ... volumes: ...').

# (Avoid /var/backups/ — the OS uses it for backing up OS related files.)
backup_archives_dir=/var/opt/backups/talkyard/v1/archives

talkyard_dir=/opt/talkyard-v1
ty_data_dir=/var/talkyard/v1
uploads_dir=$ty_data_dir/pub-files/uploads

# Make the archives dir writable to root, and readable only by people in the root group.
# (--mode has precedence over umask.)
#
mkdir -p --mode=750 $backup_archives_dir


# A random value
# -------------------

random_value=$( cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 20 )
log_message "Generated random test-that-backups-work value: '$random_value'"

# Include a file with a per backup random value. We'll insert this random value
# into the PostgreSQL database and uploads directory too. Then, on an off-site
# backup server, we can check that this value is indeed included in the backups.
# If it's not, the backups are broken, and we could send an email [BADBKPEML].

rand_val_file="$backup_archives_dir/$hostname-$when-$label-random-value.txt$dot_gpg"

if [ -n "$encrypted" ]; then
  echo "$random_value" | $gpg_encrypt --output "$rand_val_file"
else
  echo "$random_value" >> "$rand_val_file"
fi


# Backups log table
# -------------------

# We remember backup file names, dates, and the random value, in our Postgres db,
# so we can check, on an off-site backup server, that the backups look recent and okay.
#
# Params:
#   $1: What are we backing up
#   $2: Backup file name.
#
insert_backup_log_row() {
  # Connects to database Ty as user Ty, and we can use :'bind_vars' in the SQL commands
  # (to avoid SQL errors if a password or label includes "'" quotes or spaces).
  psql -v when="$when" \
       -v hostname="$hostname" \
       -v label="$label" \
       -v random_value="$random_value" \
       -v what="$1" \
       -v file_name="$2" \
       --host=rdb talkyard talkyard \
       -c \
    "insert into backup_test_log3 (
        logged_at, logged_by, backup_of_what, file_name, random_value)
     values (
        now_utc(), :'hostname', :'what', :'file_name', :'random_value');"
}


# Backup Postgres
# -------------------

postgres_backup_file_name="$hostname-$when-$label-postgres.sql.gz$dot_gpg"
postgres_backup_path="$backup_archives_dir/$postgres_backup_file_name"

log_message "Backing up Postgres$encrypted to: $postgres_backup_path ..."

pgpass_file="/tmp/.pgpass"  # created in ./entrypoint.sh
export PGPASSFILE="$pgpass_file"  # default would have been ~/.pgpass

insert_backup_log_row 'rdb' "$postgres_backup_file_name"

# ---------------
# There's `cpu_*` limits in docker-compose.yml, because:
# Piping to gzip can spike the CPU to 100%, making the kernel panic.
# It then logs: [100_kernel_panic]
#
#    watchdog: BUG: soft lockup - CPU#0 stuck for 22s!
#    Kernel panic - not syncing: softlockup: hung tasks
#    ... thread stacks ...
#    ...
#    Rebooting in 10 seconds..
#
# And then this script continues, until the server reboots 10 seconds later.
#
# (This happened with a Google Compute Engine VM, after some Ubuntu Server
# software upgrade 2020-01-09?. Machine type n1-standard-1: 1 vCPU,
# 3.75 GB memory.)
#
# Instead, run gzip as a separate step — then the CPU load in the above case
# (the GCE VM) stays okay low — compared to 100% + panic crash.
# ---------------
#
# Specify --clean to include commands to drop databases, roles, tablespaces
# before recreating them.
#
# Pipe to gzip — don't save any .sql file in a separate step, because that uses more disk,
# and leaves self-hosters confused if they've run out of disk and there's uncompressed .sql
# files seemingly causing the problem.  (But the problem is rather that the disk is
# dangerously small. Therefore, running gzip in a separate step failed — gzip, when run on its
# own (not in a pipe) needs space for both the .sql and .sql.gz, but when piping, needs space
# only for .sql.gz.)
#
if [ -n "$encrypted" ]; then
  pg_dumpall --host rdb --username=postgres --clean --if-exists  \
      | gzip  \
      | $gpg_encrypt --output $postgres_backup_path
else
  pg_dumpall --host rdb --username=postgres --clean --if-exists  \
      | gzip  \
      > $postgres_backup_path
fi

log_message "Done backing up Postgres."

# If you need to backup really manually:  (untested after edits!)
# pg_dumpall --host rdb --username=postgres --clean --if-exists \
#   | gzip \
#   > "/var/opt/backups/talkyard/v1/archives/$hostname-$(date '+%FT%H%MZ' --utc)-cmdline-postgres.sql.gz"



# Backup config
# -------------------

config_backup_file_name="$hostname-$when-$label-config.tar.gz$dot_gpg"
config_backup_path="$backup_archives_dir/$config_backup_file_name"

log_message "Backing up config$encrypted to: $config_backup_path ..."

# Just backup everything we find in /opt/talkyard-v1? (We used to back up only:
#".env docker-compose.* talkyard-maint.log conf data/certbot data/sites-enabled-auto-gen".)
conf_files="*"

cd $talkyard_dir

if [ -n "$encrypted" ]; then
  # This pipes to stdout:  `tar -f -`   that is, setting the file to '-'.
  tar -czf - $conf_files  \
      | $gpg_encrypt --output $config_backup_path
else
  # This writes directly to the backup file.
  tar -czf $config_backup_path $conf_files
fi

# Hmm, better backup config first? So this'll be incl in the .sql dump?
insert_backup_log_row 'appconf' "$config_backup_file_name"

log_message "Done backing up config."



# Backup Redis
# -------------------
# """Redis is very data backup friendly since you can copy RDB files while the
# database is running: the RDB is never modified once produced, and while it gets
# produced it uses a temporary name and is renamed into its final destination
# atomically using rename(2) only when the new snapshot is complete."""
# See http://redis.io/topics/persistence

# This file is owned by user 'redis' id 999. We've added CAP_DAC_READ_SEARCH
# in docker-compose.yml so that 'root' can access this file.
redis_dump_file="$ty_data_dir/redis-data/dump.rdb"
redis_backup_file_name="$hostname-$when-$label-redis.rdb.gz$dot_gpg"

redis_backup_path="$backup_archives_dir/$redis_backup_file_name"

if [ -f $redis_dump_file ]; then
  log_message "Backing up Redis$encrypted to: $redis_backup_path ..."
  if [ -n "$encrypted" ]; then
    # -c writes to stdout.
    gzip --to-stdout $redis_dump_file \
        |  $gpg_encrypt --output $redis_backup_path
  else
    gzip --to-stdout $redis_dump_file  >  $redis_backup_path
  fi
  insert_backup_log_row 'redis' "$redis_backup_file_name"
  log_message "Done backing up Redis."
else
  log_message "No Redis dump.rdb to backup."
fi



# Backup ElasticSearch?
# -------------------
# ... later ... Not important. Can just rebuild the search index.



# Backup uploads
# -------------------

last_yyyy_mm="$(date -d "last month" +"%Y-%m")"
cur_yyyy_mm="$(date +"%Y-%m")"

last_upl_bkp_d="$hostname-uploads-up-to-incl-$last_yyyy_mm.d"
uploads_backup_d="$hostname-uploads-up-to-incl-$cur_yyyy_mm.d"

log_message "Backing up uploads$encrypted to: $backup_archives_dir/$uploads_backup_d ..."

# Don't archive all uploads every day — then we might soon run out of disk
# (if there're many uploads — they can be huge). Instead, _each_month,
# start growing a new uploads backup archive directory with a name matching:
#     -uploads-up-to-incl-<yyyy-mm>.d
# e.g.:
#     -uploads-up-to-incl-2020-01.d
# It'll include all files uploaded previous months that haven't been deleted,
# plus all files from the curent month — also if they get deleted later this
# same month (Jan 2020 in the example above).
# (But such deleted files won't appear in the *next* months' archives.)

# Is there a directory from last month, with already encrypted backups? Then,
# we can reuse those, instead of calling gpg again.
old_but_no_new_dir=''
if [[ -d "$backup_archives_dir/$last_upl_bkp_d/"
      && ! -d "$backup_archives_dir/$uploads_backup_d/" ]]; then
  old_but_no_new_dir='Y'
fi

mkdir -p $backup_archives_dir/$uploads_backup_d/

if [ -n "$encrypted" ]; then
  all_uploads="$(cd $uploads_dir && find . -type f | sort)"

  # If new month: Copy existing uploads from the last month's uploads backup directory, so
  # we won't have to encrypt everything again — could take long if many GB uploaded files.
  if [[ $old_but_no_new_dir == 'Y' ]]; then
    echo "$all_uploads" | while IFS= read -r file_path; do
      # (This: ${sth#prefix} removes 'prefix' from $sth.)
      old_bkp_path="$backup_archives_dir/$last_upl_bkp_d/${file_path#./}.gpg"
      new_bkp_path="$backup_archives_dir/$uploads_backup_d/${file_path#./}.gpg"
      if [ -f "$old_bkp_path" ]; then
        # Specify `-l` to hard link the file, instead of physically copying it. [hard_bkp_links]
        # Read here to check if works: [check_hard_lns]
        cp -al "$old_bkp_path" "$new_bkp_path"
        echo "Reusing old backup: $old_bkp_path -> $new_bkp_path"
      fi
    done
  fi

  # for file_path in $(docker exec -it $(docker ps -q -f "ancestor=busybox") sh -c "find /data -type f"); do
  #   docker exec -i $(docker ps -q -f "ancestor=busybox") sh -c "cat $file_path" | gpg --symmetric --cipher-algo AES256 -o /path/to/encrypted/$(basename $file_path).gpg
  # done

  backed_up_uploads="$(cd $backup_archives_dir/$uploads_backup_d && find . -type f | sort)"

  # This compares file 1, $all_uploads, with file 2, $backed_up_uploads, and
  # the flag -23 keeps only column 1, which is lines in $all_uploads that
  # are missing from $backed_up_uploads.
  # -1 = suppress column 1 (lines unique to FILE1)
  # -2 = suppress column 2 (lines unique to FILE2)
  # -3 = suppress column 3 (lines that appear in both files)
  #
  # (Can alternatively do this, better for performance, but harder to debug:
  # comm -23 <(find ...) <(cd ... find ...) | while ...)
  #
  new_uploads=$(comm -23 <(echo "$all_uploads") <(echo "$backed_up_uploads" | sed 's/\.gpg$//' ))

  # Backup new uploads.
  # (`while IFS= read ... do ... done` is better than `for ...`, because the former
  # works also with files with weird names, e.g. that incl spaces. Now, there aren't
  # any such file names in this case, but better safe than sorry.)
  #
  if [ -z "$new_uploads" ]; then
    echo "No new uploaded files to backup."
  else
    echo "$new_uploads" | while IFS= read -r file_path; do
      echo "Backing up: $file_path ..."
      # (This: ${sth#prefix} removes 'prefix' from $sth.)
      bkp_path="$backup_archives_dir/$uploads_backup_d/${file_path#./}.gpg"
      mkdir -p "$(dirname "$bkp_path")"
      $gpg_encrypt --output "$bkp_path" $uploads_dir/$file_path
    done
  fi

  # Could delete backups of recently deleted uploads, sth like this. But isn't it better,
  # backup & security wise, to: _each_month, copy filehash.ext.gpg  that still exist, to
  # the new uploads backup dir? Then, backups of deleted uploads will be auto deleted
  # soon anyway.
  #
  # deleted_uploads=$(comm -13 <(echo "$all_uploads") <(echo "$backed_up_uploads"))
  # echo "$deleted_uploads" | while IFS= read -r file_path; do
  #   bkp_path="$backup_archives_dir/$uploads_backup_d/${file_path#./}.gpg"
  #   if [ -f "$bkp_path" ]; then
  #     rm -f $bkp_path
  #     echo "Deleted backup for [recently deleted uploaded file]: $file_path"
  #   else
  #     echo "Backup for [recently deleted uploaded file] already gone: $file_path"
  #   fi
  # done
else
  # rsync can make hard-link copies — if there's already backups from last month, so
  # there's something to hard link to.
  #
  # To check that this works [check_hard_lns], run `stat filepath` on a file in the most
  # recent backup, and in the last-but-one backup (for example). Look at the `Inode` nr —
  # should be the same for both files. Look at `Links` — should be the same, and >= 2.
  #
  if [[ -d "$backup_archives_dir/$last_upl_bkp_d/" ]]; then
    link_dest_arg="--link-dest=$backup_archives_dir/$last_upl_bkp_d/"  # [hard_bkp_links]
  else
    link_dest_arg=''
  fi

  # The --no-* won't preserve file owner and group, instead, the backed-up copies will
  # be owned by root. (To preserve owner, we'd need CAP_CHOWN, says Gemini, but we don't
  # want to preserve owner.)  [_backup_file_perms]
  # We also chmod the files so only root and the root group can access the files,
  # and only root can write to the rsynced directories.
  /usr/bin/rsync -a --no-owner --no-group --chmod=F640,D750 \
      $link_dest_arg  \
      $uploads_dir/  \
      $backup_archives_dir/$uploads_backup_d/
fi

# Add a backup test timestamp file, so we can check that the backup archive contents is fresh.
# This creates a file like:  rand-val--2026-02-06T0425--server-hostname--NxWsTsQvVnp2y0YvN8sb
echo "$random_value" > \
    $backup_archives_dir/$uploads_backup_d/rand-val--$when--$hostname--$random_value


# Bump the mtime, so scripts/delete-old-backups.sh won't delete it too soon.
# (Otherwise rsync will have preserved the creation date of the uploads dir,
# which might be years ago.)
touch $backup_archives_dir/$uploads_backup_d

log_message "Done backing up uploads."

# Keep track of what we've backed up:
insert_backup_log_row 'pub-uploads' "$uploads_backup_d"



# Help file about restoring backups
# -------------------

# Where's a better place to document how to restore backups, than in the
# backup directory itself? Because it should get rsynced to an off-site
# extra backup server — and then, when someone logs in at that other off-site
# server to restore the backups, hen will find the instructions on how to
# actually do that.

# Store in image instead? Can then update instructions, & release w new img.
cp $talkyard_dir/docs/how-restore-backup.md $backup_archives_dir/HOW-RESTORE-BACKUPS.md

# Touch the docs file so it'll be the first thing one sees, with 'ls -halt'.
touch $backup_archives_dir/HOW-RESTORE-BACKUPS.md



log_message "Done backing up."
echo


# You can test run this script via crontab. In Bash, type:
#
#     date -s '2020-02-01 02:09:57' ; tail -f talkyard-maint.log
#
# (The script runs 02:10 by default.)
#
# Also see:  scripts/tests/test-generate-backups.sh
#


# vim: et ts=2 sw=2 tw=0 fo=r
