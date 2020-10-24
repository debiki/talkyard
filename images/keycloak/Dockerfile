# SHOULD change to:  jboss/keycloak ?  [oidc_missing]
# Repo:  https://github.com/keycloak/keycloak-containers/tree/11.0.2
FROM quay.io/keycloak/keycloak:11.0.0

EXPOSE 8113
EXPOSE 8553

# Seems these doesn't work.
ENV KEYCLOAK_HTTP_PORT=8113
ENV KEYCLOAK_HTTPS_PORT=8553

# Specifying -Djboss.http.port works though.
CMD ["-b", "0.0.0.0", "-Djboss.http.port=8113"]

# The entrypoint is:
# ENTRYPOINT [ "/opt/jboss/tools/docker-entrypoint.sh" ]
# so that's why setting CMD to just  "-b .. -D..." above, works
# (that is, the entrypoint already calls the docker-entrypoint.sh script
# — need not do from here).
