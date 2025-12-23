# Let 'appuser' access the Postgres password secret file.  [appuser_id_1000]
# (This is a Docker Compose startup hook, should run as root.)

# The appserver always looks at this exact path. [postgres_pw_path]
pw_copy=/tmp/postgres_password

echo "Post start hook: Copying Postgres password to $pw_copy..."
cp /run/secrets/postgres_password $pw_copy
chown 1000:1000 $pw_copy  # 'appuser' and 'appgroup' have id 1000.
chmod 0400 $pw_copy       # read-only

echo "Post start hook: Done."

