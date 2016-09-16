FROM node:5

RUN npm install -g bower gulp

COPY entrypoint.sh /opt/docker-entrypoint.sh
RUN  chmod ugo+x   /opt/docker-entrypoint.sh
ENTRYPOINT ["/opt/docker-entrypoint.sh"]

WORKDIR /opt/debiki/server/

# --cache-min 9999999 makes npm not try to download again and again libs that are
# cached locally already. Versions are locked anyway via npm-shrinkwrap.
CMD ["npm install --cache-min 99999999 --ignore-scripts && gulp watch"]

