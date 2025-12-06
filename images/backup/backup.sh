#!/bin/bash

function log_message {
  echo "`date --iso-8601=seconds --utc` backup-script: $1"
}

if [ $# -ne 1 ]; then
  echo "Usage: $0 dump-tag"
  echo "E.g.: $0 weekly"
  echo "or: $0 daily"
  echo "or: $0 v0.12.34-123def"
  exit 1
fi

# This'll be like:  '2025-03-17T2359Z'
when="`date '+%FT%H%MZ' --utc`"
hostname="$(hostname)"
docker='/usr/bin/docker'
docker_compose="$docker compose"
psql="psql talkyard talkyard"

encrypted=''
dot_gpg=''
if [ -f $pwd_file ]; then
  encrypted=', encrypted,'
  dot_gpg='.gpg'
fi

log_message "Backing up '$hostname', when: '$when', tag: '$1' ..."

# See the comment mentioning gzip and "soft lockup" below.
so_nice="nice -n19"
with_cpulimit="cpulimit --limit 50"

pwd_file="./encrypt-backups-passphrase"
gpg_encrypt="gpg --batch --symmetric --cipher-algo AES256 --passphrase-file $pwd_file"

# Better avoid /opt/backups/? — it's reserved by the FSH (Filesystem Hierarchy Standard)
# for legacy weirdness things.
backup_archives_dir=/var/opt/backups/talkyard/v1/archives

talkyard_dir=/opt/talkyard-v1
uploads_dir=$talkyard_dir/data/uploads

function chek_is_in_ty_dir {
  if [ "$(pwd)" != "$talkyard_dir" ]; then
    echo
    echo "You should run this script from:  $talkyard_dir/"
    echo
    echo "(Might work from elsewhere, if you edit \`talkyard_dir\`. But not tested.)"
    echo
    exit 1
  fi
}

chek_is_in_ty_dir

mkdir -p $backup_archives_dir

random_value=$( cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 20 )
log_message "Generated random test-that-backups-work value: '$random_value'"


# A random value
# -------------------

# Include a file with a per backup random value. We'll insert this random value
# into the PostgreSQL database and uploads directory too. Then, on an off-site
# backup server, we can check that this value is indeed included in the backups.
# If it's not, the backups are broken, and we could send an email [BADBKPEML].

rand_val_file="$backup_archives_dir/$hostname-$when-$1-random-value.txt$dot_gpg"

if [ -n "$encrypted" ]; then
  echo "$random_value" | $gpg_encrypt --output "$rand_val_file"
else
  echo "$random_value" >> "$rand_val_file"
fi


# Backup Postgres
# -------------------

postgres_backup_file_name="`hostname`-$when-$1-postgres.sql"
postgres_backup_path="$backup_archives_dir/$postgres_backup_file_name.gz$dot_gpg"

log_message "Backing up Postgres$encrypted to: $postgres_backup_path ..."

# Insert a backup test timestamp, and the random value, so we can check, on an
# off-site backup server, that the contents of the backup is recent and okay.
$docker_compose exec rdb $psql -c \
    "insert into backup_test_log3 (logged_at, logged_by, backup_of_what, file_name, random_value) values (now_utc(), '$hostname', 'rdb', '$postgres_backup_file_name', '$random_value');"

# Update 2025: Yes let's do, let's try with  cpulimit --limit 50
# and add  apt install cpulimits  as an installation step.
# ---------------
# Don't pipe to gzip — that can spike the CPU to 100%, making the kernel panic.
# It then logs:
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
# Specify -T so Docker won't create a tty, because that results in a Docker Compose
# stack trace and error exit code.
#
# Specify --clean to include commands to drop databases, roles, tablespaces
# before recreating them.
#
# (cron's path apparently doesn't include /sur/local/bin/)
#
if [ -n "$encrypted" ]; then
  $docker_compose exec -T rdb pg_dumpall --username=postgres --clean --if-exists  \
      | $with_cpulimit -- $so_nice  gzip  \
      | $with_cpulimit -- $so_nice  $gpg_encrypt --output $postgres_backup_path
else
  $docker_compose exec -T rdb pg_dumpall --username=postgres --clean --if-exists  \
      | $with_cpulimit -- $so_nice  gzip  \
      > $postgres_backup_path
fi

log_message "Done backing up Postgres."

# If you need to backup really manually:
# docker compose exec -T rdb pg_dumpall --username=postgres --clean --if-exists \
#   | nice -n19 gzip \
#   > "/var/opt/backups/talkyard/v1/archives/$(hostname)-$(date '+%FT%H%MZ' --utc)-cmdline-postgres.sql.gz"



# Backup config
# -------------------

config_backup_file_name="`hostname`-$when-$1-config.tar.gz$dot_gpg"
config_backup_path="$backup_archives_dir/$config_backup_file_name"

log_message "Backing up config$encrypted to: $config_backup_path ..."

# We should be in /opt/talkyard-v1/, otherwise docker-compose won't work anyway (used
# when backing up the database).  Let's double check:
chek_is_in_ty_dir

conf_files=".env docker-compose.* talkyard-maint.log conf data/certbot data/sites-enabled-auto-gen"

if [ -n "$encrypted" ]; then
  # This pipes to stdout:  `tar -f -`   that is, setting the file to '-'.
  $so_nice tar -czf - $conf_files  \
      | $with_cpulimit -- $so_nice  $gpg_encrypt --output $config_backup_path
else
  $so_nice tar -czf $config_backup_path $conf_files
fi

# Hmm, better backup config first? So this'll be incl in the .sql dump?
$docker_compose exec rdb $psql -c \
    "insert into backup_test_log3 (logged_at, logged_by, backup_of_what, file_name, random_value) values (now_utc(), '$hostname', 'config', '$config_backup_file_name', '$random_value');"

log_message "Done backing up config."


# Backup Redis
# -------------------
# """Redis is very data backup friendly since you can copy RDB files while the
# database is running: the RDB is never modified once produced, and while it gets
# produced it uses a temporary name and is renamed into its final destination
# atomically using rename(2) only when the new snapshot is complete."""
# See http://redis.io/topics/persistence

chek_is_in_ty_dir

redis_backup_path="$backup_archives_dir/`hostname`-$when-$1-redis.rdb.gz$dot_gpg"

if [ -f data/cache/dump.rdb ]; then
  log_message "Backing up Redis$encrypted to: $redis_backup_path ..."
  if [ -n "$encrypted" ]; then
    # -c writes to stdout.
    docker compose exec cache $so_nice gzip -c ./dump.rdb \
        | $with_cpulimit -- $so_nice  $gpg_encrypt --output $redis_backup_path
  else
    docker compose exec cache $so_nice gzip -c ./dump.rdb  >  $redis_backup_path
  fi
  log_message "Done backing up Redis."
else
  log_message "No Redis dump.rdb to backup."
fi



# Backup ElasticSearch?
# -------------------
# ... later ... Not important. Can just rebuild the search index.



# Backup uploads
# -------------------

chek_is_in_ty_dir

last_yyyy_mm="$(date -d "last month" +"%Y-%m")"
cur_yyyy_mm="$(date +"%Y-%m")"

last_upl_bkp_d="$(hostname)-uploads-up-to-incl-$last_yyyy_mm.d"
uploads_backup_d="$(hostname)-uploads-up-to-incl-$cur_yyyy_mm.d"

log_message "Backing up uploads$encrypted to: $backup_archives_dir/$uploads_backup_d ..."

# Insert a backup test timestamp, so we can check that the backup archive contents is fresh.
# Do this as files with the timestamp in the file name — because then they can be checked for
# by just listing (but not extracting) the contents of the archive.
# This creates a file like:  2017-04-21T0425--server-hostname--NxWsTsQvVnp2y0YvN8sb
# OOOPS, pointless now with Docker volumes instead.
backup_test_dir="$uploads_dir/backup-test"
mkdir -p $backup_test_dir
find $backup_test_dir -type f -mtime +31 -delete
touch $backup_test_dir/$when--$hostname--$random_value

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

  # Let's use a Busybox container (that's Linux with some basic stuff only) to find
  # and `cat` uploaded files. Let's start the container just once and use `exec`.
  short_random_value=$( echo "$random_value" | head -c 7 )
  busyname="talkyard-busybox-$short_random_value"
  docker run --rm -v talkyard-v1-pub-files:/pub-files:ro -d --name $busyname busybox tail -f /dev/null

  all_uploads="$(docker exec $busyname  sh -c 'cd /pub-files/uploads && find . -type f' | sort)"

  # If new month: Copy existing uploads from the last month's uploads backup directory, so
  # we won't have to encrypt everything again — could take long if many GB uploaded files.
  if [[ $old_but_no_new_dir == 'Y' ]]; then
    echo "$all_uploads" | while IFS= read -r file_path; do
      # (This: ${sth#prefix} removes 'prefix' from $sth.)
      old_bkp_path="$backup_archives_dir/$last_upl_bkp_d/${file_path#./}.gpg"
      new_bkp_path="$backup_archives_dir/$uploads_backup_d/${file_path#./}.gpg"
      if [ -f "$old_bkp_path" ]; then
        cp -a "$old_bkp_path" "$new_bkp_path"
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
  # comm -23 <(docker run ... find ...) <(cd ... find ...) | while ...)
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

      # docker exec -i $(docker ps -q -f "ancestor=busybox") sh -c "cat $file_path" | gpg --symmetric --cipher-algo AES256 -o /path/to/encrypted/$(basename $file_path).gpg

      docker exec $busyname sh -c "cat \"/pub-files/uploads/$file_path\"" \
          | $with_cpulimit -- $so_nice  $gpg_encrypt --output "$bkp_path"
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
  $so_nice  /usr/bin/rsync -a  $uploads_dir/  $backup_archives_dir/$uploads_backup_d/
fi

if [ -n "$busyname" ]; then
  echo "Stopping container $busyname ..."
  docker stop $busyname  # auto removed (`--rm`)
fi

# Bump the mtime, so scripts/delete-old-backups.sh won't delete it too soon.
# (Otherwise rsync will have preserved the creation date of the uploads dir,
# which might be years ago.)
touch $backup_archives_dir/$uploads_backup_d

log_message "Done backing up uploads."

# Keep track of what we've backed up:
$docker_compose exec rdb $psql -c \
    "insert into backup_test_log3 (logged_at, logged_by, backup_of_what, file_name, random_value) values (now_utc(), '$hostname', 'pub-uploads', '$uploads_backup_d', '$random_value');"



# Help file about restoring backups
# -------------------

# Where's a better place to document how to restore backups, than in the
# backup directory itself? Because it should get rsynced to an off-site
# extra backup server — and then, when someone logs in at that other off-site
# server to restore the backups, hen will find the instructions on how to
# actually do that.

chek_is_in_ty_dir

cp docs/how-restore-backup.md $backup_archives_dir/HOW-RESTORE-BACKUPS.md

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
