const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const RequestLogMiddleware = require('./Middleware/RequestLogMiddleware');
const ErrorResponseLogMiddleware = require('./Middleware/ErrorResponseLogMiddleware');
const LogglyTransport = require('winston-loggly-transport');

/**
 * @param opts
 *
 * @param {string} opts.appName
 * @param {string} opts.envPrefix
 *  
 * @param {Object} opts.env Custom env vars (defaults to process.env
 * 
 * @param {function(req, res):Object} opts.requestLogMeta
 * 				Assign additional meta data to request logs
 * 
 * @param {function(meta):string} opts.requestLogMessage
 * 				Create a request log, from request meta data
 *
 * @param {function(err, req, res):Object} opts.errorResponseLogMeta
 * 				Assign additional meta data to request logs
 *
 * @param {function(meta):string} opts.errorResponseLogMessage
 * 				Create a request log, from request meta data
 *
 *
 * @constructor
 */
function LoggerBoostrap(opts) {
	opts = Object.assign({
		env: process.env
	}, opts);

	if (!opts.appName) {
		throw new Error(`LoggerBootstrap failed: missing opts.appName`);
	}
	if (!opts.envPrefix) {
		throw new Error(`LoggerBootstrap failed: missing opts.envPrefix`);
	}

	function env(key, defaultVal) {
		const envKey = [opts.envPrefix, key].join('_');
		return envKey in opts.env ? opts.env[envKey] : defaultVal;
	}

	function envFlag(key, defaultVal) {
		const envVal = env(key, null);
		return envVal === null ? defaultVal : envVal === '1';
	}

	function requireEnv(key) {
		const envVal = env(key, null);
		if (envVal === null) {
			throw new Error(`Missing required env: ${key}`);
		}
		return envVal;
	}

	const Formatter = (opts) => {
		opts = Object.assign({
			timestamp: true,
			showLevel: true
		}, opts);

		return log => [
			opts.timestamp ? `${new Date().toISOString()} - ` : '',
			opts.showLevel ? `${log.level}: `: '',
			log.message
		].join('');
	};

	const logDir = path.resolve(
		process.cwd(), env('LOG_FILE_DIR', `/var/log/${opts.appName}`)
	);

	const logglyEnabled = envFlag('LOGGLY_ENABLED', false);
	const loggly = {
		name: 'loggly',
		silent: !logglyEnabled,
		level: env('LOGGLY_LEVEL', 'info'),
		token: logglyEnabled ? requireEnv('LOGGLY_TOKEN') : undefined,
		subdomain: logglyEnabled ? requireEnv('LOGGLY_SUBDOMAIN') : undefined,
		bufferInterval: parseInt(env('LOGGLY_BUFFER_INTERVAL', 10)) * 1000,
		bufferSize: parseInt(env('LOGGLY_BUFFER_SIZE', 100)),
		tags: env('LOGGLY_TAGS', '')
			.split(',')
			.filter(Boolean)
			.concat(opts.appName),
		json: true
	};

	const config = {
		appLog: {
			file: {
				name: 'file',
				silent: !envFlag('LOG_FILE_ENABLED', true),
				level: env('LOG_FILE_LEVEL', 'info'),
				filename: path.join(logDir, 'app.log'),
				maxsize: parseInt(env('LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('LOG_FILE_MAX_FILES', 10)),
				handleExceptions: true,
				humanReadableUnhandledException: true,
				tailable: true,
				json: false,
				formatter: Formatter({
					timestamp: envFlag('LOG_FILE_TIMESTAMP', true),
					showLevel: true
				})
			},
			// Write error-level logs to a different file
			errorFile: {
				name: 'error-file',
				silent: !envFlag('LOG_FILE_ENABLED', true),
				level: 'error',
				filename: path.join(logDir, 'error.log'),
				maxsize: parseInt(env('LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('LOG_FILE_MAX_FILES', 10)),
				handleExceptions: true,
				humanReadableUnhandledException: true,
				tailable: true,
				json: false,
				formatter: log =>
					(log.meta && log.meta.stack) ?
						// Log a stack, if there is one
						`Uncaught exception: ${
							// stringify error stack
							log.meta.stack.join ? log.meta.stack.join('\n') : log.meta.stack
						}` :

						// Otherwise, log like normal
						Formatter({
							timestamp: envFlag('LOG_FILE_TIMESTAMP', true),
							showLevel: true
						})(log)
			},
			console: {
				name: 'console',
				silent: !envFlag('LOG_CONSOLE_ENABLED', true),
				level: env('LOG_CONSOLE_LEVEL', 'info'),
				formatter: Formatter({
					timestamp: envFlag('LOG_CONSOLE_TIMESTAMP', false),
					showLevel: true
				})
			},
			loggly: Object.assign({}, loggly, {
				tags: loggly.tags.concat('app-log')
			})
		},
		requestLog: {
			file: {
				name: 'file',
				silent: !envFlag('REQUEST_LOG_FILE_ENABLED', true),
				level: env('REQUEST_LOG_FILE_LEVEL', 'info'),
				filename: path.join(logDir, 'access.log'),
				maxsize: parseInt(env('REQUEST_LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('REQUEST_LOG_FILE_MAX_FILES', 10)),
				tailable: true,
				json: false,
				formatter: Formatter({
					timestamp: envFlag('REQUEST_LOG_FILE_TIMESTAMP', true),
					showLevel: false
				})
			},
			console: {
				name: 'console',
				silent: !envFlag('REQUEST_LOG_CONSOLE_ENABLED', true),
				level: env('REQUEST_LOG_CONSOLE_LEVEL', 'info'),
				formatter: Formatter({
					timestamp: envFlag('REQUEST_LOG_CONSOLE_TIMESTAMP', true),
					showLevel: false
				})
			},
			loggly: Object.assign({}, loggly, {
				tags: loggly.tags.concat('access-log')
			})
		}
	};

	if(!config.appLog.file.silent || !config.appLog.errorFile.silent || !config.requestLog.file.silent) {
		fs.ensureDirSync(logDir);
	}

	const logLoggerError = loggerName => err => console.error(`${loggerName} Logger failed: ${err.stack}`);

	const createLogger = logConfig => new winston.Logger({
		transports: []
			.concat(logConfig.console.silent ? [] :
				new winston.transports.Console(logConfig.console)
					.on('error', logLoggerError('Console'))
			)
			.concat(logConfig.file.silent ? [] :
				new winston.transports.File(logConfig.file)
					.on('error', logLoggerError('File'))
			)
			.concat(!logConfig.errorFile || logConfig.errorFile.silent ? [] :
				new winston.transports.File(logConfig.errorFile)
					.on('error', logLoggerError('ErrorFile'))
			)
			.concat(logConfig.loggly.silent ? [] :
				new LogglyTransport(logConfig.loggly)
					.on('error', logLoggerError('Loggly'))
			)
	});

	const appLogger = createLogger(config.appLog);
	const requestLogger = createLogger(config.requestLog);
	
	const requestLogMiddleware = RequestLogMiddleware({
		logger: requestLogger,
		logMessage: opts.requestLogMessage,
		logMeta: opts.requestLogMeta
	});
	const errorResponseLogMiddleware = ErrorResponseLogMiddleware({
		logger: appLogger,
		logMessage: opts.errorResponseLogMessage,
		logMeta: opts.errorResponseLogMeta
	});

	return { 
		config, 
		logger: appLogger,
		requestLogger,
		requestLogMiddleware,
		errorResponseLogMiddleware
	};
}

const KB = 1024;
const MB = KB * 1024;

module.exports = LoggerBoostrap;
