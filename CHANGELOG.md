# v1.2.1

* FIX: Update winston-loggly-transport
       Remove npm-shrinkwrap, that was causing npm install issues

# v1.2.0

* FIX: Don't create log directory unless we need it. If we are silent for all file logs, don't try to create one.

# v1.1.2

* MOD: Fix error message in ErrorResponseHandler
       (was stringifying errors as "[object Object]")

# v1.1.1

* MOD: Add timestamps to file logs
* MOD: Request log timestamps is formatted differently, to match file logs
       New: `TIMESTAMP - ...`
       Old: `[TIMESTAMP] ...`
* FIX: Fix error log formatter, when message is an error object

# v1.1.0

* MOD: Use [`winston-loggly-transport`](https://github.com/aerisweather/winston-loggly-transport) in place of
       [`winston-loggly`](https://github.com/winston/winston-loggly)
       Adds support for bulk API requests
* ADD: Support `*_LOGGLY_BUFFER_INTERVAL` and `*_LOGGLY_BUFFER_SIZE` env vars
* ADD: Log to console, if any logger errors

# v1.0.0

Initial Release
