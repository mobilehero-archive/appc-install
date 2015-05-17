/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copied or otherwise redistributed without express
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var util = require('./util'),
	errorlib = require('./error'),
	debug = require('debug')('appc:use'),
	chalk = require('chalk');

function use(opts, callback, wantVersion) {
	var args = util.parseArgs(opts),
		obj,
		getLatest = !wantVersion && args.length > 1 && args[1]==='latest';

	debug('use called with args %o, getLatest=%d',args,getLatest);
	if (args.length < 2 || getLatest) {
		util.startSpinner();
		var url = util.makeURL(opts, '/api/appc/list');
		util.requestJSON(url, function(err,result) {
			util.stopSpinner();
			if (err) {
				// if already an AppCError just return it
				if (err.name === 'AppCError') {
					return callback(err);
				}
				// looks like we are offline
				if (err.code === 'ENOTFOUND' || 'ENOENT') {
					var versions = util.getInstalledVersions();
					// set active version as latest installed version
					if (getLatest) {
						latest = versions[0];
						installBin = util.getInstallBinary(opts, latest);
						if (installBin) {
							debug('making %s your active version, dir %s',latest,installBin);
							util.writeVersion(latest);
							console.log(chalk.yellow(latest)+" is now your active version");
						}
					// json output
					} else if ('json' === util.parseOpts(opts).o) {
						obj = util.getVersionJson(versions);
						console.log(JSON.stringify(obj, null, '\t'));
					// display installed versions
					} else {
						console.log(chalk.white.bold.underline('The following versions are available offline:\n'));
						util.listVersions(opts, versions);
						console.log('');
					}
					process.exit(0);
				}
				return callback(errorlib.createError('com.appcelerator.install.use.download.error',err.message||String(err)));
			}
			if (!result) { return callback(errorlib.createError('com.appcelerator.install.download.server.unavailable')); }
			debug('versions returned from registry:', result);
			if (result && result.key) {
				result = result[result.key];
			}
			if (getLatest) {
				if (!result.length) {
					console.log(chalk.red('No versions are current deployed. Please check back in a few minutes.'));
					process.exit(1);
				}
				var latest = result[0].version;
				return use(opts, callback, latest);
			}
			var theversion = util.getActiveVersion();
			// Is this JSON output ?
			if ('json' === util.parseOpts(opts).o) {
				obj = util.getVersionJson(result);
				console.log(JSON.stringify(obj, null, '\t'));
			} else if (result) {
				console.log(chalk.white.bold.underline('The following versions are available:\n'));
				util.listVersions(opts, result);
				console.log('');
			}
			else {
				console.log('No results returned. Make sure you are online.');
			}
			process.exit(0);
		});
	}
	else {
		var version = opts.version = wantVersion || args[1];
		// see if we have this version
		installBin = util.getInstallBinary(opts, version);
		// we already have this version, so we just need to write our version file and exit
		if (installBin && !opts.force) {
			debug('making %s your active version, dir %s',version,installBin);
			util.writeVersion(version);
			console.log(chalk.yellow(version)+" is now your active version");
			process.exit(0);
		}
		opts.use = true;
		// otherwise, we didn't find it, fall through so we can install it
		return callback();
	}
}

module.exports = use;
