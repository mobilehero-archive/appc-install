/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copy or otherwise redistributed without expression
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var exec = require('child_process').exec;

module.exports = function(grunt) {

	var tests = ['test/*_test.js'];

	// Project configuration.
	grunt.initConfig({
		env: {
			dev: {
				APPC_TEST: '1'
			},
			cover: {
				APPC_TEST: '1'
			}
		},
		mochaTest: {
			options: {
				timeout: 3000,
				reporter: 'spec',
				ignoreLeaks: false,
				globals: ['requestSSLHooks','requestSSLFingerprints']
			},
			src: tests
		},
		jshint: {
			options: {
				jshintrc: true
			},
			src: ['bin/appc','index.js', 'lib/**/*.js', 'test/**/*.js']
		},
		kahvesi: { src: tests },
		clean: ['tmp']
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-kahvesi');
	grunt.loadNpmTasks('grunt-env');

	// launch mock server
	grunt.registerTask('prep', function() {
		// make sure you don't load these modules before 'env' task, as
		// some constants are set based on the environment variables.
		//require('./index').log.level('warn');
		//require('./test/mock-registry').listen(require('./lib/constants').TEST_PORT);
	});

	// compose our various coverage reports into one html report
	grunt.registerTask('report', function() {
		var done = this.async();
		exec('./node_modules/grunt-kahvesi/node_modules/.bin/istanbul report html', function(err) {
			if (err) { grunt.fail.fatal(err); }
			grunt.log.ok('composite test coverage report generated at ./coverage/index.html');
			return done();
		});
	});

	grunt.registerTask('cover', ['clean', 'env:cover', 'prep', 'kahvesi', 'report']);
	grunt.registerTask('default', ['clean', 'jshint', 'env:dev', 'prep', 'mochaTest']);

};
