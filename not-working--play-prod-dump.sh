#!/bin/bash
set -x
/mnt/data/dev/play/github/play $@ -Dconfig.resource=prod-dump@192.168.0.123.conf 

