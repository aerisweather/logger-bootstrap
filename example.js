const express = require('express');
const winston = require('winston');
const app = express();
const port = 3000;

// Setup our LoggerBootstrap
process.env['TEST_API_LOG_FILE_DIR'] = `${__dirname}/log`;

process.env['ELASTICSEARCH_HOST'] = "600fcbe6aed0f6f8646d512ef9d9cf98.us-east-1.aws.found.io";
process.env['ELASTICSEARCH_PORT'] = "9243";
process.env['ELASTICSEARCH_USER'] = "elastic";
process.env['ELASTICSEARCH_PASS'] = "m9SB6zrxeTdA9icZYDuUa8ll";
process.env['TEST_API_REQUEST_LOG_ELASTICSEARCH_ENABLED'] = "true";
process.env['TEST_API_REQUEST_LOG_ELASTICSEARCH_INDEX'] = 'testing-logger-bootstrap';


const loggerBootstrap = require('./lib/LoggerBootstrap')({
    appName: 'test-api',
    envPrefix: 'TEST_API',

    requestLogMeta: (req, res) => ({
        userAgent: req.header('user-agent')
    }),
    errorResponseLogMeta: (err, req, res) => ({
        userAgent: req.header('user-agent')
    })
});

app.use(loggerBootstrap.requestLogMiddleware);

app.get('/', (req, res) => {
    loggerBootstrap.logger.info("App level log");
    res.send('Hello World!')
});

app.get('/error', (req, res, next) => {
        try {
            abc()
        } catch (err) {
            res.responseCode = 500;
            next(err)
        }
    }
);

app.use(loggerBootstrap.errorResponseLogMiddleware);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// Additional logger
// Create a new Elasticsearch logger, using bootstrapped options
const myEsLogger = new winston.createLogger({
    transports: [loggerBootstrap.ElasticsearchTransport({
        indexPrefix: 'testing-logger-bootstrap2',
    })]
});

myEsLogger.info({hello: "world"});

