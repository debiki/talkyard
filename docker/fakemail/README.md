The self signed cert was generated something like so:

```
openssl genrsa -out server.key 2048
openssl req -new -x509 -sha256 -key server.key -out server.crt -days 3650
```

The cert, `fakemail-publ-test-self-signed.crt`, is placed here:
`../app-dev/fakemail-publ-test-self-signed.crt`, so it can be copied
into the app-dev Docker image, and added to the Java cert store [26UKWD2].

