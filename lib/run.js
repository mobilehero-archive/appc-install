/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var debug = require('debug')('appc:run');
/**
 * run the real appc binary by setting up the correct environment location
 * and then delegate directly (via a spawn) to the real appc binary in our package
 */
function run(installBin, additionalArgs, cb, dontexit) {
	var async = require('async'),
		chalk = require('chalk'),
		exec = require('child_process').exec,
		spawn = require('child_process').spawn,
		path = require('path'),
		util = require('./util');

	// append any incoming program args
	var args = [installBin].concat(process.argv.splice(2));

	// add any additional args
	if (additionalArgs) {
		args = args.concat(additionalArgs);
	}

	// get the environment
	var env = process.env;

	// setup our node environment by first appending our appc node_modules
	env.NODE_PATH = path.resolve(path.join(path.dirname(installBin), '..', 'node_modules')) + path.delimiter +
			// and then our global cache directory
		path.join(util.getCacheDir(), 'node_modules') + path.delimiter +
			// then pickup any paths already setup in our env
		(env.NODE_PATH || '');

	debug('run with env=%j, args=%o', env, args);

	async.series([
		function (next) {
			var cmd = 'npm rebuild',
				packageDir = path.join(installBin, '..', '..');

			debug('run check package node version');
			if (installBin && util.isNodeVersionChanged(installBin)) {
				console.log(chalk.yellow('\nYou are attempting to run appc %s which was compiled for node %s but you are now running node %s'),
					util.getActiveVersion(), util.getPackageNodeVersion(installBin), process.version);
				console.log(chalk.yellow('Rebuilding package modules ...'));

				debug('exec: %s in dir %s', cmd, packageDir);
				exec(cmd, {cwd: packageDir, maxBuffer: 500 * 1024}, function (err, stdout, stderr) {
					if (err) {
						console.log(chalk.yellow('The rebuild was unsuccessful, please run the following command to re-build for the newer version:'));
						console.log(chalk.green('appc use %s --force\n'), util.getActiveVersion());
					} else {
						// update node version
						util.writeNodeVersion(path.join(packageDir, '..'));
						console.log(chalk.yellow('Package modules rebuilt!\n'));
					}
					next();
				});
			} else {
				next();
			}
		},
		function (next) {
			// create our child process which simply inherits this process stdio
			var child = spawn(process.execPath, args, {env: env, stdio: 'inherit'});

			// on exit of child, exit ourselves with same exit code
			child.on('close', function (code) {
				next(null, code);
			});

			// propagate signals to child process
			['SIGTERM', 'SIGUSR1', 'SIGUSR2', 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'exit'].forEach(function (name) {
				process.on(name, function () {
					debug('signal received', name, 'sending to', child);
					if (name === 'exit') {
						child.kill();
						process.exit(arguments[0]);
					} else {
						child.kill(name);
					}
				});
			});
		}
	], function (error, results) {
		if (cb) { cb(results); }
		if (!dontexit) { process.exit(results); }
	});
}

module.exports = run;
