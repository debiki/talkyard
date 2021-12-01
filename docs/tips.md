
### Debugging mobile phones you don't have

Use SauceLabs (free for open source, for short 11 minutes sessions), and Weinre,
see  [debug-ios-safari-without-iphone.md](./debug-ios-safari-without-iphone.md)
in this directory.


### Docker:

Login as root to a running container, without knowing the root password:

    s/d exec -u 0 search bash    # user id 0 = root

    # or with docker (not docker-compose):
    docker exec -u 0 -it container_name bash

Free up disk space, by deleting old images:

    docker image prune  # optionally, add:  --all

How to push images to a local repo, to test in Vagrant: see [testing-images-in-vagrant.md](./testing-images-in-vagrant.md).


### Redis

List LetsEncrypt certs: `[todoc_certs]` (find prefixes in:
images/web/openresty-pkgs/usr-local-openresty-site/lualib/resty/acme/autossl.lua)

```
# cd /opt/talkyard
# docker-compose exec cache redis-cli
> KEYS update_lock:*
> KEYS domain:*
> KEYS account_key:*

> GET domain:rsa:forum.example.com
```


Empty the db: (or `FLUSHALL` to empty all dbs — but Ty uses just one)

Don't do in Prod — the LetsEncrypt certs are kept in Redis.
[ty_v1] A 2nd Redis instance for certs?
(Better than using different dbs in the same Redis process)

```
$ d/c exec cache redis-cli
> FLUSHDB
```

### Regular expressions, regexps, regexs

Nice graph over character classes like `[[:print:]]` and what they mean:
https://en.cppreference.com/w/c/string/byte/isgraph


### ElasticSearch stuff:

If the disk is >= 95% full, ElasticSearch enters read-only mode (or read-delete-only).
Once you've freed up disk, you need to tell ElasticSearch about this:

```
curl -XPUT -H "Content-Type: application/json" \
    http://localhost:9200/_all/_settings \
    -d '{"index.blocks.read_only_allow_delete": null}'
```

Thereafter ElasticSearch should start working again. Docs:
https://www.elastic.co/guide/en/elasticsearch/reference/6.2/disk-allocator.html


List indexes:  
http://localhost:9200/_aliases

List everything:  
http://localhost:9200/_search?pretty&size=9999

List posts in site 3:  
http://localhost:9200/all_english_v1/post/_search?pretty&routing=3&size=9999

Search:  
http://localhost:9200/_search?pretty&q=approvedText:zzwwqq2

Status of everything:  
http://localhost:9200/_cat?v

Request body search:  

```
$ curl -XGET 'http://localhost:9200/_search' -d '{
    "query" : {
        "term" : { "approvedText" : "something" }
    }
}
```

Reindex everything: (might take long: minutes/hours/weeks, depending on db size)

```
curl -XDELETE 'http://localhost:9200/all_english_v1/'
docker-compose restart web app
```


### Nodejs

If you get this error, although *not* out of disk, when running Gulp:

```
ENOSPC: no space left on device, watch '/opt/talkyard/server/client/app/page/'
```

Then, the problem is probably that Gulp needs to watch for changes in really many files,
and we need to tell the OS to let Gulp do that, by increasing the number of allowed
inode watchers. Append this to `/etc/sysctl.conf`: (on your host OS, not in a container)

```
###################################################################
# Nodejs
#
# Nodejs might believe we're out of disk space, unless it can watch really many files:
fs.inotify.max_user_watches=524288
```

Then reload `sysctl.conf`, like so: `sysctl --system`. (Persists across reboots.)

See https://stackoverflow.com/questions/22475849/node-js-error-enospc and
https://github.com/npm/npm/issues/1131#issuecomment-253065331


### Downloading backups

You can tell rsync to not download only the current month's backups, e.g.:

```
rsync -av  \
  --prune-empty-dirs  --include='*2019-12*' --include='*/' --exclude='*' \
  -e 'ssh -i ~/.ssh/id_rsa.pub' \
  root@...:/.../backups/  \
  /home/user/...-backups
```


### ASCII punctuation chars

```
!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~

! " # $ % & ' () * + , - .  / : ; < = > ?  @ ` [ \ ~ ] ↑ ^ ← _ { ¬ | }
```
