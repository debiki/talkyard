sudo docker run --rm -p 127.0.0.1:5432:5432 kajmagnus/debiki-dev-db:v3 /usr/lib/postgresql/9.3/bin/postgres -D /var/lib/postgresql/9.3/main -c config_file=/etc/postgresql/9.3/main/postgresql.conf
