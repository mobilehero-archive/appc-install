/**
 * download and install the appcelerator package
 */
var fs = require('fs'),
	path = require('path'),
	urllib = require('url'),
	download = require('./download'),
	util = require('./util'),
	targz = require('../vendor/tar.gz'),
	gzip = new targz(),
	chalk = require('../vendor/chalk'),
	red = chalk.red,
	grey = chalk.grey,
	exec = require('child_process').exec;

/**
 * run the pre-flight check to check env for specific things we need
 */
function preflight(opts, callback) {
	switch (process.platform) {
		case 'darwin': {
			// must have Xcode tools to compile so let's check that
			return exec("xcode-select -p", function(err,stdout) {
				var exitCode = err && err.code;
				if (exitCode===2) {
					// this means we don't have Xcode CLI tools, prompt to install it
					// you do this by trying to invoke gcc which will automatically install
					exec("gcc", function (err,stdout){
						return callback(new Error("Appcelerator tools require Xcode command line developers tools to be installed before continuing.  Choose an option in the dialog to download the command line developer tools. Once you have completed the installation, please re-run this command."));
					});
				}
				else {
					callback();
				}
			});
			break;
		}
	}
	callback();
}

/**
 * tar gunzip our package into dir
 */
function extract (filename, dir, callback, attempts) {
	attempts = attempts || 0;
	util.waitMessage('Installing ...');
	util.ensureDir(dir);
	gzip.extract(filename,dir, function(err) {
		// callback(err, filename, dir);
		// let errors fail through and attempt to do it again. we seem to have
		// failures ocassionally on extraction
		var pkg = path.join(dir, 'package', 'package.json');
		if (fs.existsSync(pkg)) {
			util.okMessage();
			return callback(null, filename, dir);
		}
		else {
			if (attempts < 3) {
				//console.log('extraction failed, attempting again',attempts+1);
				extract(filename, dir, callback, attempts + 1);
			}
			else {
				callback(new Error("extraction failed. please re-run the same command again."));
			}
		}
	});
}

/**
 * find all native compiled modules. the publish command detected any npm modules that had a native
 * compiled library and marked it by creating an empty file .nativecompiled during tar.gz.  we are going
 * to find all those specific modules and then re-install using npm so that they can be properly compiled
 * on the target platform during install.
 */
function findAllNativeModules(dir){ 
	var dirs = [];
	fs.readdirSync(dir).forEach(function(name){
		if (name === '.nativecompiled' && dirs.indexOf(dir)===-1) {
			dirs.push(dir);
		}
		var fn = path.join(dir, name);
		if (fs.statSync(fn).isDirectory()) {
			dirs = dirs.concat(findAllNativeModules(fn));
		}
	});
	return dirs;
}

/**
 * run npm install on all compiled native modules so that they will be 
 * correctly compiled for the installed platform (vs. the platform we used to upload)
 */
function compileNativeModules(dir, callback) {
	process.nextTick(function(){
		var dirs = findAllNativeModules(dir),
			finished = 0,
			length = dirs.length;
		if (length) {
			util.waitMessage('Compiling platform native modules ...');
			for (var c=0;c<length;c++) {
				var name = path.basename(dirs[c]),
					todir = path.dirname(dirs[c]),
					cmd = 'npm install '+name+' --production';
				//console.log(cmd);
				exec(cmd,{cwd:todir}, function(err,stdout,stderr){
					if (err) {
						util.stopSpinner();
						console.log(stderr||stdout);
					}
					finished++;
					if (finished === length) {
						util.okMessage();
						callback();
					}
				});
			}
		}
		else {
			callback();
		}
	});
}

function showBanner(opts) {
	// skip banner if provided
	if (opts.banner===false) { return; }
	console.log();
	// 99 is the minimum width to show the big banner, else we show the puny one
	if (process.stdout.columns < 99) {
		console.log(red("Appcelerator")+grey("®"));
	}
	else {
		console.log(red(" █████")+grey("╗")+red(" ██████")+grey("╗")+red(" ██████")+grey("╗")+red("  ██████")+grey("╗")+red("███████")+grey("╗")+red("██")+grey("╗")+red("     ███████")+grey("╗")+red("██████")+grey("╗")+red("  █████")+grey("╗")+red(" ████████")+grey("╗")+red(" ██████")+grey("╗")+red(" ██████")+grey("╗ ®"));
		console.log(red("██")+grey("╔══")+red("██")+grey("╗")+red("██")+grey("╔══")+red("██")+grey("╗")+red("██")+grey("╔══")+red("██")+grey("╗")+red("██")+grey("╔════╝")+red("██")+grey("╔════╝")+red("██")+grey("║     ")+red("██")+grey("╔════╝")+red("██")+grey("╔══")+red("██")+grey("╗")+red("██")+grey("╔══")+red("██")+grey("╗╚══")+red("██")+grey("╔══╝")+red("██")+grey("╔═══")+red("██")+grey("╗")+red("██")+grey("╔══")+red("██")+grey("╗"));
		console.log(red("███████")+grey("║")+red("██████")+grey("╔╝")+red("██████")+grey("╔╝")+red("██")+grey("║     ")+red("█████")+grey("╗  ")+red("██")+grey("║     ")+red("█████")+grey("╗  ")+red("██████")+grey("╔╝")+red("███████")+grey("║   ")+red("██")+grey("║   ")+red("██")+grey("║   ")+red("██")+grey("║")+red("██████")+grey("╔╝"));
		console.log(red("██")+grey("╔══")+red("██")+grey("║")+red("██")+grey("╔═══╝ ")+red("██")+grey("╔═══╝ ")+red("██")+grey("║     ")+red("██")+grey("╔══╝  ")+red("██")+grey("║     ")+red("██")+grey("╔══╝  ")+red("██")+grey("╔══")+red("██")+grey("╗")+red("██")+grey("╔══")+red("██")+grey("║   ")+red("██")+grey("║   ")+red("██")+grey("║   ")+red("██")+grey("║")+red("██")+grey("╔══")+red("██")+grey("╗"));
		console.log(red("██")+grey("║  ")+red("██")+grey("║")+red("██")+grey("║     ")+red("██")+grey("║     ╚")+red("██████")+grey("╗")+red("███████")+grey("╗")+red("███████")+grey("╗")+red("███████")+grey("╗")+red("██")+grey("║  ")+red("██")+grey("║")+red("██")+grey("║  ")+red("██")+grey("║   ")+red("██")+grey("║   ╚")+red("██████")+grey("╔╝")+red("██")+grey("║  ")+red("██")+grey("║"));
		console.log(grey("╚═╝  ╚═╝╚═╝     ╚═╝      ╚═════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝"));
	}
	console.log();
}

/**
 * start the install process
 */
function start (opts, callback) {

	// show our banner
	showBanner(opts);

	// do our pre-flight checks
	preflight(opts, function(err){

		// if we have pre-flight check failure, handle special
		if (err) {
			console.error(chalk.yellow.bold(err && err.message || String(err)));
			process.exit(1);
		}

		util.infoMessage(chalk.blue.underline.bold('Before you can continue, the latest Appcelerator software update needs to be downloaded.'));
		console.log();

		callback(null,true);
	});
}

/**
 * run the install
 */
function install (installDir, opts, cb) {

	start(opts, function(err,result){
		if (!result) {
			util.stopSpinner();
			console.log('Cancelled!');
			process.exit(1);
		}

		// determine our registry url
		var wantVersion = opts.version || '',
			url = util.makeURL(opts, '/install-appc/'+wantVersion),
			bin = wantVersion && util.getInstallBinary(opts, wantVersion);

		// if already installed the version we're looking for, then we just need to continue
		if (bin && !opts.force) {
			util.infoMessage('Version '+chalk.green(wantVersion)+' already installed.');
			return cb && cb(null, installDir, wantVersion, bin);
		}

		// download the binary
		download.start(!!opts.force,url,wantVersion,function(err,filename,version,installBin) {
			if (err) { util.fail(err); }

			// ensure that we have our installation path
			installDir = util.ensureDir(path.join(installDir,version));

			// we already have it installed, just return
			if (installBin) {
				util.infoMessage('Version '+chalk.green(version)+' already installed.');
				return cb && cb(null, installDir, version, installBin);
			}

			// extract it
			extract(filename, installDir, function(err,filename,dir){
				if (err) { util.fail(err); }

				// compile any native modules found
				compileNativeModules(dir, function(err){

					// point at the right version that we just downloaded
					installBin = util.getInstallBinary(opts,version);

					if (err) { util.fail(err); }

					util.infoMessage(chalk.green.bold('Installed!!'));

					// if this is a use or setup, we don't run, we just return
					if (opts.use || opts.setup) { return cb && cb(null, installDir, version, installBin); }
					// run it
					require('./index').run(installBin,['--no-banner']);
				});
			});
		});

	});

}

module.exports = install;
