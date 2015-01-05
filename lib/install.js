/**
 * download and install the appcelerator package
 */
var fs = require('fs'),
	path = require('path'),
	urllib = require('url'),
	download = require('./download'),
	util = require('./util'),
	errorlib = require('./error'),
	zlib = require('zlib'),
	tar = require('tar'),
	chalk = require('chalk'),
	exec = require('child_process').exec;

/**
 * tar gunzip
 */
function targz(sourceFile, destination, callback) {
	fs.createReadStream(sourceFile)
		.pipe(zlib.createGunzip())
		.pipe(tar.Extract({ path: destination }))
		.on('error', function(err) { callback(err)})
		.on('end', function() { callback(null)});
}

/**
 * run the pre-flight check to check env for specific things we need
 */
function preflight(opts, callback) {

	var isWindows = util.isWindows();

	// don't allow running this as root (defeats the purpose of writing to the user-writable directory)
	if (!isWindows && (process.env.USER==='root' || process.getuid()===0)) {
		if (process.env.SUDO_USER) {
			return callback(errorlib.createError('com.appcelerator.install.installer.sudo',process.env.SUDO_USER));
		}
		return callback(errorlib.createError('com.appcelerator.install.installer.user.root'));
	}
	// don't allow running as sudo from another user account.
	else if (!isWindows && (process.env.USERNAME==='root' && process.env.SUDO_USER)) {
		return callback(errorlib.createError('com.appcelerator.install.installer.user.sudo.user',process.env.SUDO_USER));
	}

	// check and make sure we actually have a home directory
	var homedir = util.getHomeDir();
	if (!fs.existsSync(homedir)) {
		var envname = process.env.HOME ? 'HOME' : 'USERPROFILE';
		return callback(errorlib.createError('com.appcelerator.install.installer.missing.homedir',homedir,chalk.yellow('$'+envname)));
	}

	// make sure the user home directory its writable
	var error = util.checkDirectory(homedir,'home');
	if (error) {
		return callback(error);
	}

	// make sure the install directory its writable
	var installDir = util.getInstallDir();
	error = util.checkDirectory(installDir,'install');
	if (error) {
		return callback(error);
	}

	// check parent directory to make sure owned by the user
	error = util.checkDirectory(path.dirname(installDir),'appcelerator');
	if (error) {
		return callback(error);
	}

	switch (process.platform) {
		case 'darwin': {
			// must have Xcode tools to compile so let's check that
			return exec("xcode-select -p", function(err,stdout) {
				var exitCode = err && err.code;
				if (exitCode===2) {
					// this means we don't have Xcode CLI tools, prompt to install it
					// you do this by trying to invoke gcc which will automatically install
					exec("gcc", function (err,stdout){
						return callback(errorlib.createError('com.appcelerator.install.preflight.missing.xcode.clitools'));
					});
				}
				else {
					callback();
				}
			});
		}
		default: break;
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
	var error = util.checkDirectory(dir,'install');
	if (error) {
		return callback(new Error(error));
	}
	targz(filename, dir, function(err) {
		// let errors fail through and attempt to do it again. we seem to have
		// failures ocassionally on extraction
		var pkg = path.join(dir, 'package', 'package.json');
		if (fs.existsSync(pkg)) {
			util.okMessage();
			return callback(null, filename, dir);
		}
		else {
			if (attempts < 3) {
				// reset the line since it will be in the Installing... spinner state
				util.resetLine();
				// delete the directory since stale directories cause issues
				util.rmdirSyncRecursive(dir);
				//console.log('extraction failed, attempting again',attempts+1);
				extract(filename, dir, callback, attempts + 1);
			}
			else {
				callback(errorlib.createError('com.appcelerator.install.installer.extraction.failed'));
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
		if (fs.existsSync(fn) && fs.statSync(fn).isDirectory()) {
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
				/*jshint -W083 */
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

/**
 * start the install process
 */
function start (opts, callback) {

	// do our pre-flight checks
	preflight(opts, function(err){

		// if we have pre-flight check failure, handle special
		if (err) {
			console.error(chalk.red("\n"+(err && err.message || String(err))));
			process.exit(1);
		}

		if (!opts.quiet){
			util.infoMessage(chalk.blue.underline.bold('Before you can continue, the latest Appcelerator software update needs to be downloaded.'));
			console.log();
		}

		callback(null,true);
	});
}

function showBanner(opts) {
	// skip banner if provided
	if (opts.banner===false || opts.quiet) { return; }
	console.log();
	// 99 is the minimum width to show the big banner, else we show the puny one
	if (process.stdout.columns < 99) {
		console.log(red("Appcelerator")+grey("®"));
	}
	else {
		var red = chalk.red,
			grey = chalk.grey;
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
 * run setup
 */
function runSetup(installBin, opts, cb) {
	// splice our setup command in
	var found = util.parseArgs(opts);
	if (found && found.length && found[0]!=='setup') {
		var remaining = process.argv.splice(found.length?3:2);
		process.argv = process.argv.splice(0,2).concat(['setup']).concat(remaining);
	}
	// run it
	require('./index').run(installBin,['--no-banner']);
}

/**
 * run the install
 */
function install (installDir, opts, cb) {

	// show our banner
	showBanner(opts);

	start(opts, function(err,result){
		if (!result) {
			util.stopSpinner();
			if (!opts.quiet) { console.log('Cancelled!'); }
			process.exit(1);
		}

		// determine our registry url
		var wantVersion = opts.version || '',
			url = util.makeURL(opts, '/install-appc/'+wantVersion),
			bin = wantVersion && util.getInstallBinary(opts, wantVersion);

		// if already installed the version we're looking for, then we just need to continue
		if (bin && !opts.force) {
			if (!opts.quiet) { util.infoMessage('Version '+chalk.green(wantVersion)+' already installed.'); }
			return cb && cb(null, installDir, wantVersion, bin);
		}

		// download the package
		download.start(!!opts.force,url,wantVersion,function(err,filename,version,installBin) {
			if (err) { util.fail(err); }

			// we mark it as failed in case it gets interuppted before finishing
			var failed = true;

			// use this since below we are going to overwrite which might be null
			var installationDir = path.join(installDir,version);

			var sigIntFn, exitFn, pendingAbort;

			function createCleanup(name) {
				return function (exit) {
					if (failed) {
						var pkg = path.join(installationDir, 'package', 'package.json');
						if (fs.existsSync(pkg)) { fs.unlinkSync(pkg); }
					}
					// if exit, go ahead and exit with exitcode
					if (name==='exit') {
						try {
							process.removeListener('exit',exitFn);
						}
						catch (e) {
							// this is OK
						}
						if (pendingAbort) {
							process.exit(exit);
						}
					}
					// if failed and a SIGINT, force an exit
					else if (failed) {
						pendingAbort = true;
						util.abortMessage('Install');
					}
					try {
						process.removeListener('SIGINT',sigIntFn);
					}
					catch (e){
						// this is OK
					}
				};
			}

			// we need to hook and listen for an interruption and remove our package
			// in case the install is interrupted, we don't want a package that is partly installed
			process.on('SIGINT', (sigIntFn=createCleanup('SIGINT')));
			process.on('exit', (exitFn=createCleanup('exit')));

			util.stopSpinner();

			// ensure that we have our installation path
			installDir = util.ensureDir(path.join(installDir,version));

			// we already have it installed, just return
			if (installBin) {
				failed = false;
				createCleanup()();
				if (!opts.quiet) { util.infoMessage('Version '+chalk.green(version)+' already installed.'); }
				if (opts.setup){
					return runSetup(installBin, opts, cb);
				}
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

					// mark it as completed so we know we completed OK
					failed = false;

					// if this is a setup, then run the setup after the install
					if (opts.setup) {
						return runSetup(installBin, opts, cb);
					}

					var launchMessage = ' Launching ... ' + (util.isWindows() ? '' : '🚀');

					if (!opts.quiet) { util.infoMessage(chalk.green.bold('Installed!!'+ (!opts.use&&!opts.setup?launchMessage:''))); }

					// if this is a use or setup, we don't run, we just return
					if (opts.use) { return cb && cb(null, installDir, version, installBin); }

					// run it
					require('./index').run(installBin,['--no-banner']);
				});
			});
		});

	});

}

module.exports = install;
