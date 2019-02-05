const onFinished = require('on-finished');

/**
 * @param opts
 *
 * @param {winston.Logger} opts.logger
 *
 * @param {function(meta):string} opts.logMessage
 *        Log message template
 *
 * @param {function(req, res):Object} opts.logMeta
 *        Assign additional meta data to logs
 *
 * @return {function(req, res, next)}
 * @constructor
 */
function RequestLogMiddleware(opts) {
    opts.logMessage || (opts.logMessage = (logMeta) => [
        logMeta.method,
        logMeta.path,
        logMeta.statusCode,
        `${logMeta.duration} ms`,
        `-`,
        logMeta.length
    ].join(' '));

    opts.logMeta || (opts.logMeta = (req, res) => ({}));

    return (req, res, next) => {
        const startHrTime = process.hrtime();
        const reqTime = new Date();

        onFinished(res, (err, res) => {
            const hrTimeDiff = process.hrtime(startHrTime);
            const msDiff = hrTimeDiff[0] * 1000 + Math.round(hrTimeDiff[1] / 1000000);

            const logMeta = Object.assign({
                date: reqTime.toISOString(),
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                duration: msDiff,
                length: res.get('content-length')
            }, opts.logMeta(req, res));

            const msg = opts.logMessage(logMeta);

            opts.logger.info(msg, logMeta);
        });
        next();
    };
}

module.exports = RequestLogMiddleware;