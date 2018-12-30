
Install Weinre.  [WEINRE]
---------


```
cd ~/app/  # if you keep Node.js apps in  ~/app/node_modules
yarn add weinre

# fix a bug in Weinre:  (see https://stackoverflow.com/a/46426558/694469 )
vi ~/app/node_modules/connect/lib/middleware/static.js

# change from:   mime = require('mime');
# to:            mime = require('mime-types');
#
# and if needed, back in Bash:
yarn add mime-types
```

See if works:

```
~/app/node_modules/.bin/weinre --boundHost 127.0.0.1  --httpPort 8090
```

Now, open  http://127.0.0.1:8090  in your browser. Now, Weinre shouldn't crash (because bug fixed,
see above), but should show access points and a Target Script.

Place the Target Script on the web page you'd like to debug. E.g. in:
`(talkyard-repo)/app/views/debikiScriptsHead.scala.html` — *however* this has already been done,
in hacks.ts. Instead just append this to the page's URL:  `#&loadWeinre`

Type `make up` to start Talkyard, and open a Talkyard discussion page in a browser,
e.g. `http://localhost#&loadWeinre`

In Weinre, click the "debug client user interface" and then click the link in the Targets list
(should be one link). Then look at the discussion page, and in the Weinre Elements tab,
point on different elems and see them highlightd on the dicussion page.


Setup a SauceLabs tunnel
---------

Signup for Sauce, free for open source.

Download and extract Sauce Connect Proxy:  https://app.saucelabs.com/tunnels

```
cd ~/app/
tar -xf ~/Downloads/sc-4.5.2-linux.tar.gz
ll sc-4.5.2-linux/bin/sc
-rwxr-xr-x 1 yourname yourname 27060911 nov 26 17:29 sc-4.5.2-linux/bin/sc
```


Open port: (as per the https://app.saucelabs.com/tunnels instructions)

```
sudo ufw allow out 443   # if you're on Linux and use  ufw
```

Start the tunnel:

```
bin/sc -u YOUR_SAUCELABS_USERNAME -k SECRET_VALUE_SAUCE_LABS_WILL_GIVE_YOU
```

Start Selenium and run a test:

```
# In one shell:
./node_modules/.bin/http-server -p8080 target/   # if you want to test iframe emb cmts
s/selenium-start

# In another:  ( --da means debug-after, that is, don't close the test browser(s))
s/wdio target/e2e/wdio.conf.js            --only embedded-comments-discussion-id --da
```

And start a SauceLabs test, use the tunnel, and point the iOS browser to:
`http://e2e-test-embdscid.localhost:8080/emb-cmts-bbb.html`

