const LoggerBootstrap = require('../../lib/LoggerBootstrap');
const assert = require('assert');

assert.partial = (actual, expectedPartial, msg) => {
	const actualPartial = Object.keys(actual)
		.reduce((partial, key) => (
			key in expectedPartial ?
				Object.assign(partial, { [key]: actual[key] }) :
				partial
		), {});

	assert.deepStrictEqual(actualPartial, expectedPartial, msg);
};

describe('LoggerBootstrap', () => {

	describe('logger config', () => {

		it('should use a default config, if none is specified', () => {
			const loggerBootstrap = LoggerBootstrap({
				appName: 'test-app',
				envPrefix: 'TEST_APP',
				env: {
					// We have to specify this, because
					// we may not have permissiont create dir in
					// default /var/log/
					TEST_APP_LOG_FILE_DIR: 'log'
				}
			});

			const config = loggerBootstrap.config;

			assert.partial(config.appLog.file, {
				silent: false,
				level: 'info',
				filename: `${process.cwd()}/log/app.log`,
				maxsize: 1024 * 1024 * 10,		// 10 MB
				maxFiles: 10,
				tailable: true
			}, 'app log (file)');

			assert.partial(config.appLog.console, {
				silent: false,
				level: 'info',
			}, 'app log (console)');

			assert.partial(config.requestLog.file, {
				silent: false,
				level: 'info',
				filename: `${process.cwd()}/log/access.log`,
				maxsize: 1024 * 1024 * 10,		// 10 MB
				maxFiles: 10,
				tailable: true
			}, 'access log (file)');

			assert.partial(config.appLog.console, {
				silent: false,
				level: 'info',
			}, 'access log (console)');
		});

		it('should create config for a winston log, using env vars', () => {
			const loggerBootstrap = LoggerBootstrap({
				appName: 'test-app',
				envPrefix: 'TEST_APP',
				env: {
					TEST_APP_LOG_FILE_DIR: 'log',

					// app log (file)
					TEST_APP_LOG_FILE_ENABLED: '1',
					TEST_APP_LOG_FILE_LEVEL: 'info',
					TEST_APP_LOG_FILE_MAX_SIZE: 507,
					TEST_APP_LOG_FILE_MAX_FILES: 11,
					TEST_APP_LOG_FILE_TIMESTAMP: '1',

					// app log (console)
					TEST_APP_LOG_CONSOLE_ENABLED: '1',
					TEST_APP_LOG_CONSOLE_LEVEL: 'verbose',
					TEST_APP_LOG_CONSOLE_TIMESTAMP: '0',

					// access log (file)
					TEST_APP_REQUEST_LOG_FILE_ENABLED: '0',
					TEST_APP_REQUEST_LOG_FILE_LEVEL: 'verbose',
					TEST_APP_REQUEST_LOG_FILE_MAX_SIZE: 202,
					TEST_APP_REQUEST_LOG_FILE_MAX_FILES: 6,
					TEST_APP_REQUEST_LOG_FILE_TIMESTAMP: '0',

					// access log (console)
					TEST_APP_REQUEST_LOG_CONSOLE_ENABLED: '0',
					TEST_APP_REQUEST_LOG_CONSOLE_LEVEL: 'silly',
					TEST_APP_REQUEST_LOG_CONSOLE_TIMESTAMP: '1'
				}
			});

			const config = loggerBootstrap.config;

			assert.partial(config.appLog.file, {
				silent: false,
				level: 'info',
				filename: `${process.cwd()}/log/app.log`,
				maxsize: 507,
				maxFiles: 11,
				tailable: true
			}, 'app log (file)');

			assert.partial(config.appLog.console, {
				silent: false,
				level: 'verbose',
			}, 'app log (console)');

			assert.partial(config.requestLog.file, {
				silent: true,
				level: 'verbose',
				filename: `${process.cwd()}/log/access.log`,
				maxsize: 202,
				maxFiles: 6,
				tailable: true
			}, 'access log (file)');

			assert.partial(config.requestLog.console, {
				silent: true,
				level: 'silly',
			}, 'access log (console)');
		});

	});

});

