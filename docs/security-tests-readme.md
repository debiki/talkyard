EffectiveDiscussions security tests
===================================

The security tests are written in TypeScript and use Tape = test-anything-protocol for Node.js.
They send requests to Nginx, so they can test the whole stack (which however wouldn't have been
possible if they had been functional tests written in Scala for the app server only).


Running
---------------

```
sudo s/d up -d
sudo s/d-run-security-tests
```


Debugging
---------------

```
sudo s/d up -d
sudo s/d-debug-security-tests
```

You'll see:

> ...
> To start debugging, open the following URL in Chrome:
>    chrome-devtools://devtools/bundled/inspector.html...
> ...

Do that, i.e. open that URL in Chrome or Opera.

(More about debugging in Node.js 7.4 here:
https://nodejs.org/api/debugger.html#debugger_v8_inspector_integration_for_node_js)
