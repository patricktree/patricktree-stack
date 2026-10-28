#!/bin/sh
# Runs Playwright Server and stops it once no client has been connected for 10 minutes. Test runs
# share this container and never stop it themselves, so idleness is the only signal that it is no
# longer needed. Stopping the server exits the container, and `--rm` removes it.
set -eu

idle_timeout_seconds=600
# Test runs touch this file via `docker exec` (see `ACTIVITY_MARKER_PATH` in the global setup) when
# they pick this container, so it is not stopped between that moment and the run's first browser
# connection.
activity_marker=/tmp/last-used
log_file=/tmp/run-server.log
poll_interval_seconds=10

touch "${activity_marker}"
# The server's redirect creates the log file in a background process, so `tail` could start first and
# fail. Creating it here keeps the port line from going missing in `docker logs`.
: >"${log_file}"

# The server listens on a port the operating system assigns; test runs read it from `docker logs`.
./node_modules/.bin/playwright run-server --host 0.0.0.0 >"${log_file}" 2>&1 &
server_pid="${!}"
tail -n +1 -f "${log_file}" &
tail_pid="${!}"

port=""
while [ -z "${port}" ] && kill -0 "${server_pid}" 2>/dev/null; do
  sleep 1
  port="$(sed -n 's/.*Listening on ws:\/\/0\.0\.0\.0:\([0-9]*\).*/\1/p' "${log_file}")"
done

if [ -n "${port}" ]; then
  port_hex="$(printf '%04X' "${port}")"

  while kill -0 "${server_pid}" 2>/dev/null; do
    sleep "${poll_interval_seconds}"

    # With host networking the kernel's TCP tables list the host's connections. A server-side socket
    # of an established connection (state 01) has this server's port in its local address.
    if grep -qE "^ *[0-9]+: [0-9A-F]+:${port_hex} [0-9A-F]+:[0-9A-F]+ 01 " /proc/net/tcp /proc/net/tcp6 2>/dev/null; then
      touch "${activity_marker}"
    fi

    if [ "$(($(date +%s) - $(stat -c %Y "${activity_marker}")))" -ge "${idle_timeout_seconds}" ]; then
      echo "No client connected for ${idle_timeout_seconds} seconds, stopping Playwright Server"
      kill "${server_pid}"
      break
    fi
  done
fi

status=0
wait "${server_pid}" || status="${?}"
kill "${tail_pid}" 2>/dev/null || true
exit "${status}"
