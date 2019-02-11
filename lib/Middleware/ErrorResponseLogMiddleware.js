/**
 *
 * @param opts
 * @param {winston.Logger} opts.logger
 *
 * @param {function(req, res):Object} opts.logMeta
 *        Assign additional meta data to logs
 *
 * @param {function(meta):string} opts.logMessage
 *        Create a log message, from log meta data
 *
 * @returns {function(err, req, res, next}
 * @constructor
 */
function ErrorResponseLogMiddleware(opts) {
    opts.logMeta || (opts.logMeta = (err, req, res) => ({}));

    opts.logMessage || (opts.logMessage = meta =>
            meta.statusCode >= 500 ?
                [
                    `ServerError (${meta.statusCode}): ${meta.error.stack}`,
                    `Url: ${meta.url}`
                ].join('\n') :
                `ClientError (${meta.statusCode}): ${meta.error.message}`
    );

    return function (err, req, res, next) {
        const logMeta = Object.assign({
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack
            },
            url: req.originalUrl,
            statusCode: res.statusCode
        }, opts.logMeta(err, req, res));

        const logMessage = opts.logMessage(logMeta);

        if (res.statusCode >= 400 && res.statusCode < 500) {
            opts.logger.verbose(logMessage, logMeta);
        }
        else {
            opts.logger.error(logMessage, logMeta);
        }

        next(err);
    };

}

module.exports = ErrorResponseLogMiddleware;
