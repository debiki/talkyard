Talkyard development
=============================


Editing source code
-----------------------------

### Typescript

To edit Typescript code (in `client/app-*/`) you can use VSCode.

To automatically recompile code you've edited, so the changes appear in your
browser after reload, do this:

```
s/tyd tw   # 'tw' means "transpile" and "watch"
```

But wait five seconds, after you've edited any Typescript code, before you reload the page in
the browser — otherwise the Typescript code might not yet have been transpiled.
(Details: There's a Docker container with Node.js installed, which recompile Typescript and Stylus CSS.)

### Scala

To edit Scala code (in `app/*`), you can use IntelliJ IDEA, the free community edition:
https://www.jetbrains.com/idea/download/#section=linux

There's a container, named *app*, which runs the Play Framework application server,
and looks for changes to Scala files, recompiles and reloads.

To start SBT in a docker container and jump into the SBT console:

```
s/tyd ca   # 'ca' means "Console for the App server"
```

Unfortunately, if you keep editing and reloading Scala files many many times, then eventually
Play Framework runs out of memory. Restart it like so: `s/tyd ra` ('ra' means "restart app").

### Database

To delete and recreate an empty database:

```
s/drop-database-create-empty.sh
```

To jump into the PostgreSQL console: (maybe to try out SQL commands to put in
a new database migration file — they're in `appsv/rdb/src/main/resources/db/migration/`)

```
s/tyd cd   # 'cd' means "Console for the Database server"
```


About the images
-----------------------------

Here you can read about the various images in the Talkyard stack:
[about-the-talkyard-images.md](./docs/about-the-talkyard-images.md).



Troubleshooting
-----------------------------

See [tips.md](./docs/tips.md).



Tests
-----------------------------

#### End-to-end tests

The end-to-end tests are written in TypeScript and uses Selenium and Webdriver.io.
See the [end-to-end tests readme](./docs/e2e-tests-readme.md).
And, you also need to [make *.localhost addresses work](./docs/wildcard-dot-localhost.md),
because the e2e tests creates test sites at `*.localhost` sub domains.


#### Security tests

The security tests are written in TypeScript and use Tape = test-anything-protocol for Node.js.
See the [security tests readme](./docs/security-tests-readme.md).


#### Unit tests

Stop everything: `sudo docker-compose down` and then: `s/cli` then type `test` + hit Enter.


#### Performance tests

Install Scala SBT, see http://www.scala-sbt.org/download.html. On Linux:

```
echo "deb https://dl.bintray.com/sbt/debian /" | sudo tee -a /etc/apt/sources.list.d/sbt.list
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2EE0EA64E40A89B84B2DF73499E82A75642AC823
sudo apt-get update
sudo apt-get install sbt
```

Append to `/etc/security/limits.conf` ... hmm but now with Docker-Compose, which container?

    your_login_name hard nofile 65535
    your_login_name soft nofile 65535

Configure very high max-requests-per-ip-per-second etc Nginx limits — otherwise during the performance
test Nginx will start to rate limit stuff and reply 503 Service Not Available:

```
sudo docker-compose  -f docker-compose.yml  -f docker-compose-no-limits.yml  up -d
```



Directories
-----------------------------

This project looks like so:


    server/
     |
     +-Makefile        <-- You can build Talkyard, using GNU Make
     |
     +-docker-compose.yml   <-- Tells Docker how to run Talkyard
     |
     +-client/         <-- A React.js web app, incl styles (Stylus, .styl files)
     | +-app-slim/     <-- Scripts loaded on page load (in slim-bundle.min.js)
     | +-app-more/     <-- Scripts loaded if interacting w page (more-bundle.min.js)
     | +-app-editor/   <-- The editor
     | +-app-staff/    <-- The admin area
     | +-server/       <-- React.js components rendered server side,
     | :                   usually softlinks to ../app-slim/
     | :
     |
     +-appsv/          <-- Application server
     | +-model/        <-- Domain model (Scala case classes) and utility functions
     | +-rdb/          <-- A Data Access Object (DAO) implementation for PostgreSQL
     | +-server/       <-- The actual app server — a Play Framework 2 application
     |
     +-tests/
     | +-app/          <-- Unit tests and functional tests, for the app server
     | +-e2e/          <-- End-to-end tests
     | +-security/     <-- Security tests
     |
     +-modules/
     | +-ed-prod-one-test/  <-- A production installation, for automatic tests
     | |
     | ...Third party modules
     |
     +-to-talkyard/    <-- For converting e.g. phpBB or Disqus export files
     |                     to Talkyard's JSON format, so they can be imported
     |                     into Talkyard. This is a stand-alone Node.js app.
     |
     +-images/
     | +-web/          <-- For building the 'web' Docker image, runs Nginx
     | | +-Dockerfile
     | | +-assets/     <-- Bundled scripst and styles, from client/app-*/*
     | | +-modules/    <-- Nginx (OpenResty) and Lua modules
     | | +-openresty/  <-- OpenResty source code (we build from source)
     | | ...
     | |
     | +-gulp/         <-- An image that runs Node.js and bundles JS and CSS
     | |
     | +-...           <-- More images, see: docs/about-the-talkyard-images.md
     |
     +-volumes/
     | +-rdb-data      <-- Mounted as a volume in the Postgres container
     | +-gulp-home/    <-- Gulp container home-dir = disk cache
     | +-uploads       <-- Mounted read-write in the Play container, but
     | |                 read-only in Nginx (to serve static files)
     | ...
     |
     +-vendors/
     | +-jars/         <-- JAR files needed to build and run Talkyard. (a Git
     |                     submodule)
     +-node_modules/   <-- Vendored Nodejs dependencies (a Git submodule)
     |
     +-d/         <-- Docker scripts, e.g. d/c is docker-compose, and
     |                'd/n a-script' runs a-script in a Nodejs Docker container
     |                ('docker-compose' is soo loong to type).
     |                Many scripts still in s/* instead, could move to here?
     |
     +-s/         <-- Utility Bash scripts (typing "scripts/" is so long),
     |                e.g. s/run-e2e-tests.sh, or, to run in a container:
     |                'd/n s/run-e2e-tests.sh'  — combining the d/* and s/*
     |                scripts.
     |
     +-conf/      <-- App server (Play Framework) config files
     | +-my.conf  <-- You can add your localhost config here. Ignored by Git.



Naming style, tags and a new word
-----------------------------

### CSS classes and ids

*Example*: `s_P_By_FN-Gst`. Here, `s_` is a prefix used for all classes, and
it means "some". For ids we use `t_` instead, means "the". `P` means Post. `By` means
who-was-it-written-By. `FN` means Full Name. `Gst` means Guest.

So, this is BEM (Block Element Modifier) with a few tweaks: Blocks/elements are separated with
only one underscore, and modifiers with only one dash. Blocks, elems and modifiers always
start with uppercase — because then it's easy to tell if we're dealing with an _abbreviation_
or not. For example, `FN` (full name) is an abbreviation. But `By` is not (since it continues with
lowercase letters).

Another example: `s_Dfs_Df_Ttl` — this means the title (Ttl), of a draft (Df),
in a list of drafts (Dfs).  You'll find abbreviations like Ttl and Df, in
[bem-blocks.txt](./docs/bem-blocks.txt).

<!-- I think these short names actually improve readability, once you know what they means.
Seeing `s_Dfs_Df_Ttl` in the source code — that's brief and quick to read, doesn't steal
the attention from other things nearby you're probably more inteested in.
(too chatty, skip this)  -->

For stuff with otherwise no class or id, and that should be clicked in end-to-end tests,
we use classes only, and the prefix `e_` (instead of `s_` or `t_`).


### Single and double quotes

In Typescript (and any Javascript), use single quotes for strings the computer cares about,
like CSS classes or ids, e.g. `className: 's_P'` or `reactRenderMethod = 'hydrate'`,
or React component display names.
For texts that humans read, instead use double quotes, like: `Button({ ...}, "Undo")`.
When doing this, you can be fairly certain that if you edit a single quote string,
without knowing what you're doing, something will break.
Whilst if you edit a double quoted string and fix e.g. a spelling errors: the computer
won't care, but humans like it.


### Tag the code

Some parts of a software system, knows how other parts of the software system works,
sometimes in not-obvious ways. Make such otherwise hidden duplicated knowledge visible,
by tagging the code with tags like: `[1ABCDE2]`.
Example: `// Also done here: [4JKAM7] when deleting pages.`.
Or there's a 3rd partly lib bug workaround in one source code file, for a problem that happens
in a different file, and an end-to-end test that got affected, example: `[5QKBRQ]`.
Tag those three places with the same tag.
Just type a number, random uppercase letters, and another number, to create a tag.
And copy-paste it to where the related code is.


### Message codes and magic underscores

Log messages, and plain text messages sent back to the browser, start with `TyM` if it's
an info message, and `TyE` if it's an error. Like, `"Started. [TyMSTARTED]"` (a log message).

These messsage codes helps you instantly find the relevat source code, if there's
an error message anywhere. Otherwise, it can be terribly annoying,
when the browser says "Not found", and you have no idea where that message comes from.
For example, Nginx didn't find a location handler? Or a user is missing? Or a page? Or a post?
Or a client side route is missing? Or the hostname is wrong? Or ...?
And you search for "Not found" and find 1 000 matches.
Now, instead, you'll see `"Not found [TyE123ABC]"` — and you then search for "TyE123ABC"
and find the relevant source code.

Some message codes sent to the browser are checked for in end to end tests. They shall
have an underscore `_` at the *end* (because it's called *end* to *end* tests). So, if you see a
message code like: `"TyM0APPR_"` and you change it, you need to search for it
everywhere and update some end-to-end tests too.

Some message codes are checked for by production code Typescript, i.e. *front*end code.
They shall have a `_` at the beginnign (front) of the error code, and here's how they can be used
server side: `throwForbidden("_TyE403BPWD", "Bad username or password")` and
client side: `if (xhr.responseText.indexOf('_TyE403BPWD') ...`. — So, when you're looking at the
server side code the `_` tells you that the error code is used in the frontend Typescript code,
so you cannot just change it.


### Database tables, constraints, index names

Add "as many constraints and foreign keys as you can". Knowing precisely what's in the
database, makes data migrations safer & simpler. Don't forget to index
foreign key columns. Type `ix: index-name` next to the foreign key constraints,
so one directly sees that there's an index, and its name. All fk constraints should
be deferrable.

**Table names:** `some_table3`. The trailing digit "3" is for historical reasons —
maybe change to "_t" instead? *Some* suffix is needed, so one can search
for `table_name3` e.g. `pages3` and find only the *table*, instead of 999 999
other unrelated "table_name" e.g. "pages" search hits.

**Unique indexes:** `tablename_u_columnone_coltwo_three...`

**Non-unique indexes:** `tablename_i_colone_coltwo_three...`

**Foreign keys:** `tablename_colone_coltwo_..._r_othertable(_col_coltwo_...)`

**Check constraints:** `tablename_c_...sth-to-check...` e.g. `pages_c_id_len` (length).

It's nice to have these one letter object types: `_u`, `_i`, `_c` because then they're
more full text searchable — e.g. find all usages of any (unique) indexes on a certain
table, accross the whole code base. And you soon learn to recognize what they mean so you know
what type of thing it is, without having to think or find out. Having them directly
after the table name (without the '3' suffix) makes things nicely aligned & easy to scan,
when typing `\d some_table_name` in the psql client.

Maybe it'd be nice if all column names ended with "_c"? E.g. `username_c`.
Because currently they're a bit hard to search for. Instead one needs to search
for the table name, and then look for the column name, in the surrounding code.

Most db things don't follow these naming standards, because I (KajMagnus) had different
ideas in the past. Maybe one day, time to rename everything to the correct names?


### Hen and henbirds

Source code comments should be concise, but writing "he or she" everywhere, when referring
to e.g. a user, becomes a bit verbose (because "he or she" is three words). There's
a short Swedish word that means "he or she", namely "hen". Let's start using it in English.

So: "hen" = either "he or she", or "him or her", depending on context.
And "hens" = "his or her", and "hen's" = "he or she is".

To refer to many hen = many-he-or-she, write "people". "Hens" however
means "his or her", just like "its" means, well, "its" (but not "things").

What about the bird previously called "hen"? Let's call it "henbird" instead.

So, hereafter, the word "hen" means "he or she". And the henbird, which I cannot
remember having mentioned or even thought about the past year, no longer gets
to occupy the short and useful word "hen".



Custom third party builds
-----------------------------

We're building & using a smaller version of Lodash, like so:
(this makes slim-bundle.min.js.gz 8kb = 4% smaller, as of September 2016)

    # COULD create custom typedef for this custom Lodash, so won't accidentally use
    # Lodash fns that have been excluded here?

    node_modules/lodash-cli/bin/lodash \
      include="assign,assignIn,before,bind,chain,clone,cloneDeep,compact,concat,create,debounce,defaults,defer,delay,each,escape,every,filter,find,findLast,flatten,flattenDeep,forEach,forOwn,groupBy,has,head,includes,identity,indexOf,isArguments,isArray,isBoolean,isDate,isEmpty,isEqual,isFinite,isFunction,isNaN,isNull,isNumber,isObject,isRegExp,isString,isUndefined,iteratee,keys,last,map,mapValues,matches,max,min,mixin,negate,noConflict,noop,once,partition,pick,reduce,remove,result,size,slice,some,sortBy,sumBy,take,tap,throttle,thru,toArray,uniq,uniqBy,uniqueId,value,values" \
      --output client/third-party/lodash-custom.js

    # If you upgrade Lodash, afterwards, have a look at the diff of `lodash-custom.js`
    # and scroll down towards the bottom. Look at the line `lodash.cloneDeep =` and below:
    # did any function unexpectedly disappear? If so, include it in the long list above
    # and regenerate `lodash-custom.js`.

- For security reasons, we checkin only the resulting `.js` file (but not the `.min.js`) file
into source control (so that you can read the source code and see what it does).
- There are some Gulp plugins that builds Lodash but one seems abandonend (gulp-lodash-builder)
and the other (gulp-lodash-custom) analyzes all .js files, I guess that'd slow down the build
rather much + won't immediately work with Typescript?



vim: list et ts=2 sw=2 tw=0 fo=r
