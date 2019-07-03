db-backup:
image: mariadb:10
env_file: /share/appdata/config/nextcloud/nextcloud-db-backup.env
depends_on:
- db
volumes:
- /share/appdata/nextcloud/database-dump:/dump
- /etc/localtime:/etc/localtime:ro
entrypoint: |
bash -c 'bash -s <<EOF
trap "break;exit" SIGHUP SIGINT SIGTERM
sleep 2m
while /bin/true; do
mysqldump -h db --all-databases | gzip -c > /dump/dump_\`date +%d-%m-%Y"_"%H_%M_%S\`.sql.gz
(ls -t /dump/dump*.sql.gz|head -n $$BACKUP_NUM_KEEP;ls /dump/dump*.sql.gz)|sort|uniq -u|xargs rm -- {}
sleep $$BACKUP_FREQUENCY
done
EOF'
networks:
- internal
