#!/bin/sh
### BEGIN INIT INFO
# Provides:          otto
# Required-Start: 
# Required-Stop:
# Should-Start:
# Default-Start:
# Default-Stop:
# X-Interactive:     true
# Short-Description: Otto AI
### END INIT INFO
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -f /bin/setupcon ]; then
    case "$1" in
        stop)
            cd $DIR
            yarn pm2 stop otto
        ;;
        start)
            cd $DIR
            yarn pm2 start pm2.js
	    ;;
        restart|reload|force-reload)
            cd $DIR
            yarn pm2 start pm2.js -f
        ;;
        *)
            echo 'Usage: /etc/init.d/otto {start|reload|restart|force-reload|stop|status}'
            exit 3
            ;;
    esac
fi