FROM node:5

RUN npm install -g bower gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

WORKDIR /opt/debiki/server/

# About using tsc, see [6KGEF02] in gulpfile.js.
CMD ["npm install --ignore-scripts && bower install && node_modules/typescript/bin/tsc -w -p client/app/ & gulp watch"]

