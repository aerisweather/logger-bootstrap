# v1.3.4

* Lock into winston-elasticsearch version
  https://github.com/vanthome/winston-elasticsearch/issues/40

# v1.3.3

* Support `ELASTICSEARCH_INDEX_SUFFIX` env var

# v1.3.2

* Expose `ElasticsearchTransport` factory

# v1.3.1

* Fix missing default `indexPrefix` for ES transports

# v1.3.0

* MOD: Add support for Elasticsearch transport

# v1.2.2

* MOD: Assign names to all transports, so they can be removed by client, if they want.
       eg. `loggerBootstrap.requestLogger.remove('loggly')`

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
