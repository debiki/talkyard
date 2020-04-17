#!/bin/bash


# For now, later, create new dir?
rm -f ./target/e2e-test-logs/*


if [ -z "SKIP" ]; then
  echo ""  # noop
fi  # / SKIP



# ===== Forum tests


find specs/ -type f  \
    | egrep -v '[23]browsers'  \
    | egrep -v 'embedded-|UNIMPL|-impl\.|imp-exp-imp-exp-site'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --parallel 3

    # | grep 'navigation-as' \

find specs/ -type f  \
    | egrep '2browsers'  \
    | egrep -v 'embedded-|UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --2browsers

find specs/ -type f  \
    | egrep '3browsers'  \
    | egrep -v 'embedded-|UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --3browsers



# ===== Embedded comments tests


# With cookies tests.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep -v 'gatsby'  \
    | egrep -v 'no-cookies'  \
    | egrep -v 'embedded-forum'  \
    | egrep -v '[23]browsers|UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --static-server-8080


# Cookies blocked tests.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep 'no-cookies'  \
    | egrep -v 'embedded-forum'  \
    | egrep -v '[23]browsers|UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --static-server-8080  --b3c

# Two browsers tests. (There are none without cookies.)
rm -f ./target/emb-comments-site-dump.json  # for the export-import tests
find specs/ -type f  \
    | egrep '2browsers'  \
    | egrep 'embedded-'  \
    | egrep -v 'UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --static-server-8080  --2browsers

# Gatsby, v1.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep 'gatsby'  \
    | egrep -v 'UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --static-server-gatsby-v1-8000

# Gatsby, old deprecated Talkyard names.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep 'gatsby'  \
    | egrep -v 'UNIMPL|-impl\.'  \
    | sort \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --static-server-gatsby-v1-old-ty-8000



# ===== Report results


cat_failures='cat target/e2e-test-logs/*'

echo "======================================================================="
echo "Done. Failures: (between --- and ====)"
echo "-----------------------------------------------------------------------"
echo "$cat_failures"
$cat_failures
echo "======================================================================="


fail_files="$(ls ./target/e2e-test-logs/)"
if [ -z "$fail_files" ]; then
  echo "All fine — no failure files found. Exiting with status 0."
  exit 0
else
  echo "TESTS FAILED: Failure files found, see above. Exiting with status 1."
  exit 1
fi
