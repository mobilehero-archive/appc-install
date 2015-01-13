/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copy or otherwise redistributed without expression
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var util = require('./util'),
	errorlib = require('./error'),
	chalk = require('chalk');

function use(opts, callback, wantVersion) {
	var args = util.parseArgs(opts),
		getLatest = !wantVersion && args.length > 1 && args[1]==='latest';
	if (args.length < 2 || getLatest) {
		util.startSpinner();
		var url = util.makeURL(opts, '/list-appc');
		util.requestJSON(url, function(err,result){
			util.stopSpinner();
			if (err) { return callback(errorlib.createError('com.appcelerator.install.use.download.error',err.message||String(err))); }
			if (getLatest) {
				return use(opts, callback, result.latest);
			}
			console.log(chalk.white.bold.underline('The following versions are available:\n'));
			var theversion = util.getActiveVersion();
			Object.keys(result.versions).forEach(function(ver){
				var entry = result.versions[ver];
				var msg = util.getInstallBinary(opts,ver) ? 'Installed' : 'Not Installed';
				if (result.latest === ver) {
					msg+=chalk.white.bold(' (Latest)');
				}
				if (theversion && theversion===ver) {
					msg+=chalk.red(' (Active)');
				}
				console.log(chalk.yellow(util.pad(ver, 10))+' '+chalk.cyan(util.pad(msg, 40))+' '+chalk.grey(util.pad(new Date(Date.parse(entry.date)),15)));
			});
			console.log('');
			process.exit(0);
		});
	}
	else {
		var version = opts.version = wantVersion || args[1];
		// see if we have this version
		installBin = util.getInstallBinary(opts, version);
		// we already have this version, so we just need to write our version file and exit
		util.writeVersion(version);
		if (installBin && !opts.force) {
			console.log(chalk.yellow(version)+" is now your active version");
			process.exit(0);
		}
		opts.use = true;
		// otherwise, we didn't find it, fall through so we can install it
		return callback();
	}
}

module.exports = use;
