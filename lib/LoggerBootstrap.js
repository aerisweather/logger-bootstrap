const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const RequestLogMiddleware = require('./Middleware/RequestLogMiddleware');
const ErrorResponseLogMiddleware = require('./Middleware/ErrorResponseLogMiddleware');
require('winston-loggly');
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
 * @param {function(req, res):Object} opts.errorResponseLogMeta
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

	const logglyEnabled = envFlag('LOGGLY_ENABLED', false);
	const loggly = {
		silent: !logglyEnabled,
		level: env('LOGGLY_LEVEL', 'info'),
		token: logglyEnabled ? requireEnv('LOGGLY_TOKEN') : undefined,
		subdomain: logglyEnabled ? requireEnv('LOGGLY_SUBDOMAIN') : undefined,
		tags: env('LOGGLY_TAGS', '')
			.split(',')
			.filter(Boolean)
			.concat(opts.appName),
		json: true
	};
	
	const formatter = log => `${log.level}: ${log.message}`;
	const formatterNoLevel = log => log.message;

	const logDir = path.resolve(
		process.cwd(), env('LOG_FILE_DIR', `/var/log/${opts.appName}`)
	);
	fs.ensureDirSync(logDir);

	const config = {
		appLog: {
			file: {
				name: 'app-log',
				silent: !envFlag('LOG_FILE_ENABLED', true),
				level: env('LOG_FILE_LEVEL', 'info'),
				filename: path.join(logDir, 'app.log'),
				maxsize: parseInt(env('LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('LOG_FILE_MAX_FILES', 10)),
				timestamp: envFlag('LOG_FILE_TIMESTAMP', true),
				tailable: true,
				formatter: formatter
			},
			// Write error-level logs to a different file
			errorFile: {
				name: 'error-log',
				silent: !envFlag('LOG_FILE_ENABLED', true),
				level: 'error',
				filename: path.join(logDir, 'error.log'),
				maxsize: parseInt(env('LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('LOG_FILE_MAX_FILES', 10)),
				timestamp: envFlag('LOG_FILE_TIMESTAMP', true),
				tailable: true,
				formatter: formatter
			},
			console: {
				silent: !envFlag('LOG_CONSOLE_ENABLED', true),
				level: env('LOG_CONSOLE_LEVEL', 'info'),
				timestamp: envFlag('LOG_CONSOLE_TIMESTAMP', true),
				formatter: formatter
			},
			loggly: Object.assign({}, loggly, {
				tags: loggly.tags.concat('app-log'),
				formatter: formatter
			})
		},
		requestLog: {
			file: {
				silent: !envFlag('REQUEST_LOG_FILE_ENABLED', true),
				level: env('REQUEST_LOG_FILE_LEVEL', 'info'),
				filename: path.join(logDir, 'access.log'),
				maxsize: parseInt(env('REQUEST_LOG_FILE_MAX_SIZE', MB * 10)),
				maxFiles: parseInt(env('REQUEST_LOG_FILE_MAX_FILES', 10)),
				timestamp: envFlag('REQUEST_LOG_FILE_TIMESTAMP', true),
				tailable: true,
				formatter: formatterNoLevel
			},
			console: {
				silent: !envFlag('REQUEST_LOG_CONSOLE_ENABLED', true),
				level: env('REQUEST_LOG_CONSOLE_LEVEL', 'info'),
				timestamp: envFlag('REQUEST_LOG_CONSOLE_TIMESTAMP', true),
				formatter: formatterNoLevel
			},
			loggly: Object.assign({}, loggly, {
				tags: loggly.tags.concat('access-log'),
				formatter: formatterNoLevel
			})
		}
	};

	const createLogger = logConfig => new winston.Logger({
		transports: []
			.concat(logConfig.console.silent ?
				[] : new winston.transports.Console(logConfig.file)
			)
			.concat(logConfig.file.silent ?
				[] : new winston.transports.File(logConfig.file)
			)
			.concat(logConfig.loggly.silent ?
				[] : new winston.transports.Loggly(logConfig.loggly))
	});

	const appLogger = createLogger(config.appLog);
	const requestLogger = createLogger(config.requestLog);
	
	const requestLogMiddleware = RequestLogMiddleware({
		logger: requestLogger,
		logMessage: opts.requestLogMessage,
		logMeta: opts.requestLogMeta
	});
	const errorResponseLogMiddleware = ErrorResponseLogMiddleware({
		logger: requestLogger,
		logMessage: opts.errorResponseLogMessage,
		logMeta: opts.errorResponseLogMeta
	});

	return { 
		config, 
		appLogger,
		errorLogger,
		requestLogger,
		requestLogMiddleware,
		errorResponseLogMiddleware
	};
}

const KB = 1024;
const MB = KB * 1024;

module.exports = LoggerBoostrap;
