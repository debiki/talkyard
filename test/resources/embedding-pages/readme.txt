Find here static HTML pages that use Debiki Embedded Comments. That is, they
contain iframe(s) that show embedded comments.

The iframes assume that a Play Framework listens on port 19001, because
that's the port on which Play's test server listens.

***

To serve the pages in this folder over HTTP on port 8080, do this:

Install Node.js
$ sudo npm install http-server -g
$ cd to-this-directory
$ http-server

Also add entries like
127.0.0.1	mycomputer
127.0.0.1	site-10.localhost
127.0.0.1	site-11.localhost
127.0.0.1	site-12.localhost
127.0.0.1	site-13.localhost
127.0.0.1	site-14.localhost
127.0.0.1	site-15.localhost
...
to your hosts file (/etc/hosts).  Then the embedding pages will be served from
one domain, and the embedded iframes from another, which tests that Debiki
doesn't have any cross domain issues.



