var util = require('./util'),
	chalk = require('../vendor/chalk');

function use(opts, callback) {
	var args = util.parseArgs(opts);
	if (args.length < 2) {
		var url = util.makeURL(opts, '/list-appc');
		util.requestJSON(url, function(err,result){
			if (err) { return util.fail(err); }
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
		var version = opts.version = args[1];
		// see if we have this version
		installBin = util.getInstallBinary(opts, version);
		// we already have this version, so we just need to write our version file and exit
		if (installBin) {
			util.writeVersion(version);
			console.log(chalk.yellow(version)+" is now your current version");
			process.exit(0);
		}
		opts.use = true;
		// otherwise, we didn't find it, fall through so we can install it
		return callback();
	}
}

module.exports = use;
