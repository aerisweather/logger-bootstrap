# LoggerBootstrap

Bootstraps [Winston](https://github.com/winstonjs/winston) logging services and middleware for your Node.js app.

## Why?

I'm getting tired of bootstrapping logging services for every app I work on.

Here are my biggest pain points:

* Creating logging services for multiple log types and transports
* Loading in environment variables for each configuration setting, and for each logging service (lots of config!)
* Setting up logging middleware
* Inconsistent logging behavior between applications (eg. different file names, message formats, etc)

`LoggerBootstrap` simplifies this by:
* Creating standard logging services for app logs, error logs, and access logs
* Loading in environment variables, using a standardized naming convention
* Using sane defaults of logging config
* Providing Express middleware

## Setup

Install `LoggerBootstrap` from npm:

```
npm install --save logger-bootstrap
```

Then bootstrap your loggers:

```js
const LoggerBootstrap = require('logger-bootstrap');

const services = LoggerBootstrap({
	appName: 'my-app',
	envPrefix: 'MY_APP'
});

// You now have access to a winston logger
// fully configured to write to the console, the file system,
// and Loggly (optional)
services.logger.log('My app has a logging service!');

// You also have Express middleware 
// for access logs, and error logs
const app = require('express')();

// Set up an access log
app.use(services.requestLogMiddleware);

// Set up a response error log (logs 500 errors)
app.use(services.errorResponseLogMiddleware);
```

## Environment Reference

`LoggerBootstrap` pulls in config from environment variables. If no environment variables are defined, sane defaults will be used instead.

Each variable is prefixed with the `envPrefix` passed to `LoggerBootstrap`.

Default environment variables (using `MY_APP` as an example prefix):

```
# All variables are optional, 
# unless otherwise noted

# Location of all log files. May be relative to cwd
MY_APP_LOG_FILE_DIR=/var/log/my-app

# Application file logs (app.log)
MY_APP_LOG_FILE_ENABLED=1
MY_APP_LOG_FILE_LEVEL=info
MY_APP_LOG_FILE_MAX_SIZE=1048576	# (10 MB)
MY_APP_LOG_FILE_MAX_FILES=10
MY_APP_LOG_FILE_TIMESTAMP=1

# Application console logs
MY_APP_LOG_CONSOLE_ENABLED=1
MY_APP_LOG_CONSOLE_LEVEL=info
MY_APP_LOG_CONSOLE_TIMESTAMP=1

# Request file logs (access.log)
MY_APP_REQUEST_LOG_FILE_ENABLED=1
MY_APP_REQUEST_LOG_FILE_LEVEL=info
MY_APP_REQUEST_LOG_CONSOLE_TIMESTAMP=1

# Request console logs
MY_APP_REQUEST_LOG_CONSOLE_ENABLED=1
MY_APP_REQUEST_LOG_CONSOLE_LEVEL=info
MY_APP_REQUEST_LOG_CONSOLE_TIMESTAMP=1

# Loggly logs (disabled by default)
MY_APP_LOGGLY_ENABLED=0
MY_APP_LOGGLY_LEVEL=info
# Comma separated tags
# Note that the app name and log type (app-log or access-log) 
# are automatically tagged to every log
MY_APP_LOGGLY_TAGS=
# required, if loggly is enabled
MY_APP_LOGGLY_TOKEN=
# required, if loggly is enabled
MY_APP_LOGGLY_SUBDOMAIN=
```

## LoggerBootstrap Options

`LoggerBootstrap` accepts the following options:

```js
// All options are optional, 
// unless otherwise noted
LoggerBootstrap({
    // Used to determine the default log file location
    // eg. /var/log/map-app/
    // Also, added as a tag to all Loggly logs
    // (required)
	appName: 'my-app',
	
	// Environment variable prefix
	// (required)
	envPrefix: 'MY_APP',

	// Use custom environment variables.
	// Defaults to `process.env`
	env: process.env,

	// Define additional meta data to be
	// passed along with request logs
	requestLogMeta: (req, res) => ({})

	// Define a custom request log message
	requestLogMessage: (logMeta) => '',

	// Define additional meta data to be
	// passed along with error response logs
	errorResponseLogMeta: (req, res) => ({})

	// Define a custom error response log message
	errorResponseLogMessage: (logMeta) => ''

});
```