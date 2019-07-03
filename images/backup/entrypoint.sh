# Split this into an entrypoint script that calls the backup scripts?
# + docker-compose.yml configuration?
#
# see e.g.:
#   https://github.com/paysera/piwik/blob/master/docker-compose.yml#L48
#   https://github.com/nextcloud/docker/issues/36#issuecomment-435948722
backup:
  image: postgres:10.x.y
  env_file: something.env?  backup.env?
depends_on:
  - rdb  # pg_dumpall connects to
volumes:
  - same-as-rdb
  - same-as-uploaded-files
  - /etc/localtime:/etc/localtime:ro  # ??
entrypoint: |
  # move to script
  bash -c 'bash -s <<EOF
  trap "break;exit" SIGHUP SIGINT SIGTERM
  sleep 2m
  while /bin/true; do
    pg_dump ... all databases ... | gzip -c > dump  ... %d-%m-%Y"_"%H_%M_%S  .sql.gz
    + rm old backups:  keep all date? + keep none date?
    sleep $$BACKUP_FREQUENCY
  done
  EOF'
networks:
- ...
