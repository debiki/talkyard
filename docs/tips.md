
### ElasticSearch stuff:

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
