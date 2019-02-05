const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const RequestLogMiddleware = require('./Middleware/RequestLogMiddleware');
const ErrorResponseLogMiddleware = require('./Middleware/ErrorResponseLogMiddleware');

/**
 * @param opts
 *
 * @param {string} opts.appName
 * @param {string} opts.envPrefix
 *
 * @param {Object} opts.env Custom env vars (defaults to process.env
 *
 * @param {function(req, res):Object} opts.requestLogMeta
 *                Assign additional meta data to request logs
 *
 * @param {function(meta):string} opts.requestLogMessage
 *                Create a request log, from request meta data
 *
 * @param {function(err, req, res):Object} opts.errorResponseLogMeta
 *                Assign additional meta data to request logs
 *
 * @param {function(meta):string} opts.errorResponseLogMessage
 *                Create a request log, from request meta data
 *
 * @param {function(data):Object} opts.elasticsearchTransformer
 *                Transformation to apply to elasticsearch log data
 *
 * @constructor
 */
function LoggerBoostrap(opts) {
    opts = {
        env: process.env,
        elasticsearchTransformer: data => data,
        ...opts
    };

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

    function requireRawEnv(key) {
        if (!(key in opts.env)) {
            throw new Error(`Missing required env: ${key}`)
        }
        return opts.env[key];
    }

    const getFormatter = (opts) => {
        opts = {
            timestamp: true,
            showLevel: true,
            ...opts
        };

        const timestampFormat = winston.format.printf(info => {
            return `[${info.timestamp}] ${info.message}`;
        });

        const timestampLevelFormat = winston.format.printf(info => {
            return `[${info.timestamp}] [${info.level}] ${info.message}`;
        });

        const levelFormat = winston.format.printf(info => {
            return `[${info.level}] ${info.message}`;
        });

        if(opts.timestamp) {
            if(opts.showLevel) {
                return timestampLevelFormat;
            }
            return timestampFormat;
        }
        if(opts.showLevel) {
            return levelFormat;
        }
        return winston.format.combine()
    };

    const logDir = path.resolve(
        process.cwd(), env('LOG_FILE_DIR', `/var/log/${opts.appName}`)
    );

    // Factory for an Elasticsearch transport
    function ElasticsearchTransport(options) {
        if (!options.indexPrefix) {
            throw new Error(`Unable to create Elasticsearch transport: missing 'indexPrefix' option`);
        }

        const defaultTransformer = require('winston-elasticsearch');
        const transformer = data => opts.elasticsearchTransformer(
            defaultTransformer(data)
        );

        return new (require('winston-elasticsearch'))(Object.assign({
            level: 'info',
            // Make sure to create a new clientOpts object for each transport
            // See https://github.com/elasticsearch/elasticsearch-js/issues/33
            clientOpts: {
                host: `https://${requireRawEnv('ELASTICSEARCH_HOST')}:${requireRawEnv('ELASTICSEARCH_PORT')}`,
                httpAuth: `${requireRawEnv('ELASTICSEARCH_USER')}:${requireRawEnv('ELASTICSEARCH_PASS')}`
            },
            // Add meta data about environment to all logs
            transformer: transformer
        }, options));
    }

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
                format: getFormatter({
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
                format: log =>
                    (log.meta && log.meta.stack) ?
                        // Log a stack, if there is one
                        `Uncaught exception: ${
                            // stringify error stack
                            log.meta.stack.join ? log.meta.stack.join('\n') : log.meta.stack
                            }` :

                        // Otherwise, log like normal
                        getFormatter({
                            timestamp: envFlag('LOG_FILE_TIMESTAMP', true),
                            showLevel: true
                        })(log)
            },
            console: {
                name: 'console',
                silent: !envFlag('LOG_CONSOLE_ENABLED', true),
                level: env('LOG_CONSOLE_LEVEL', 'info'),
                format: getFormatter({
                    timestamp: envFlag('LOG_CONSOLE_TIMESTAMP', false),
                    showLevel: true
                })
            },
            elasticsearch: {
                name: 'elasticsearch',
                silent: !envFlag('LOG_ELASTICSEARCH_ENABLED', false),
                level: env('LOG_ELASTICSEARCH_LEVEL', 'info'),
                indexPrefix: env('LOG_ELASTICSEARCH_INDEX', `${opts.appName}-logs`),
                indexSuffixPattern: env('LOG_ELASTICSEARCH_INDEX_SUFFIX', 'YYYY.MM.DD')
            }
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
                format: getFormatter({
                    timestamp: envFlag('REQUEST_LOG_FILE_TIMESTAMP', true),
                    showLevel: false
                })
            },
            console: {
                name: 'console',
                silent: !envFlag('REQUEST_LOG_CONSOLE_ENABLED', true),
                level: env('REQUEST_LOG_CONSOLE_LEVEL', 'info'),
                format: getFormatter({
                    timestamp: envFlag('REQUEST_LOG_CONSOLE_TIMESTAMP', true),
                    showLevel: false
                })
            },
            elasticsearch: {
                name: 'elasticsearch',
                silent: !envFlag('REQUEST_LOG_ELASTICSEARCH_ENABLED', false),
                level: env('REQUEST_LOG_ELASTICSEARCH_LEVEL', 'info'),
                indexPrefix: env('REQUEST_LOG_ELASTICSEARCH_INDEX', `${opts.appName}-requests`),
                indexSuffixPattern: env('REQUEST_LOG_ELASTICSEARCH_INDEX_SUFFIX', 'YYYY.MM.DD')
            }
        }
    };

    if (!config.appLog.file.silent || !config.appLog.errorFile.silent || !config.requestLog.file.silent) {
        fs.ensureDirSync(logDir);
    }

    const logLoggerError = loggerName => err => console.error(`${loggerName} Logger failed: ${err.stack}`);

    const createLogger = logConfig => new winston.createLogger({
        transports: []
            .concat(logConfig.console.silent ? [] :
                new winston.transports.Console(logConfig.console)
                    .on('error', logLoggerError('Console'))
            )
            .concat(logConfig.file.silent ? [] :
                new DailyRotateFile(logConfig.file)
                    .on('error', logLoggerError('File'))
            )
            .concat(!logConfig.errorFile || logConfig.errorFile.silent ? [] :
                new DailyRotateFile(logConfig.errorFile)
                    .on('error', logLoggerError('ErrorFile'))
            )
            .concat(logConfig.elasticsearch.silent ? [] :
                ElasticsearchTransport(logConfig.elasticsearch)
                    .on('error', logLoggerError('Elasticsearch'))
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
        errorResponseLogMiddleware,
        ElasticsearchTransport
    };
}

const KB = 1024;
const MB = KB * 1024;

module.exports = LoggerBoostrap;
