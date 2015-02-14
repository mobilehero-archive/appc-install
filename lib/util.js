/**
 * This code is closed source and Confidential and Proprietary to
 * Appcelerator, Inc. All Rights Reserved.  This code MUST not be
 * modified, copy or otherwise redistributed without expression
 * written permission of Appcelerator. This file is licensed as
 * part of the Appcelerator Platform and governed under the terms
 * of the Appcelerator license agreement.
 */
var fs = require('fs'),
	path = require('path'),
	chalk = require('chalk'),
	errorlib = require('./error'),
	urllib = require('url'),
	debug = require('debug')('appc:util'),
	spinner,
	spriteIndex = 0,
	sprite = '/-\\|';

//NOTE: not using char-spinner because i don't want it to reset to beginning
//of line each time it starts/stops. i want to spin in place at point of cursor

/**
 * start the spinner
 */
function startSpinner() {
	stopSpinner();
	if (!spinner && process.stdout.isTTY && !process.env.TRAVIS) {
		var count = 0;
		spinner = setInterval(function() {
			if (count++ > 0) {
				// go back one column
				process.stdout.write('\033[1D');
			}
			var s = ++spriteIndex % sprite.length;
			var c = sprite[s];
			process.stdout.write(c);
		},50);
	}
}

/**
 * stop the spinner
 */
function stopSpinner() {
	if (spinner) {
		clearInterval(spinner);
		// go back on column
		process.stdout.write('\033[1D');
		spinner = null;
	}
}

/**
 * write a wait message and start spinner
 */
function waitMessage (msg) {
	process.stdout.write(msg);
	startSpinner();
}

/**
 * write OK mark and stop spinner
 */
function okMessage (msg) {
	stopSpinner();
	msg = msg || '';
	process.stdout.write(msg+' '+chalk.green(isWindows()?'OK':'✓')+'\n');
}

/**
 * write message and stop spinner
 */
function infoMessage (msg) {
	stopSpinner();
	console.log(msg);
}

/**
 * return the platform specific HOME directory
 */
function getHomeDir() {
	return process.env.HOME || process.env.USERPROFILE;
}

/**
 * return our AppC directory
 */
function getAppcDir() {
	return path.join(getHomeDir(), '.appcelerator');
}

/**
 * return the global cache directory in the users home folder
 */
function getCacheDir() {
	return path.join(getAppcDir(), 'cache');
}

/**
 * return the platform specific install directory
 */
function getInstallDir () { 
	return path.join(getAppcDir(), 'install');
}

/**
 * return the version file
 */
function getVersionFile() {
	return path.join(getInstallDir(),'.version');
}

/**
 * return the config file
 */
function getConfigFile() {
	return path.join(getAppcDir(), 'appc-cli.json');
}

/**
 * return the private npm cache directory
 */
function getNpmCacheDirectory() {
	return path.join(getAppcDir(),'.npm');
}

/**
 * write out the current version file
 */
function writeVersion(version) {
	var versionFile = getVersionFile();
	debug('writing version: %s to %s',version,versionFile);
	fs.writeFileSync(versionFile,version);
}

/**
 * return the active version (if specified) or undefined
 */
function getActiveVersion() {
	var versionFile = getVersionFile();
	if (fs.existsSync(versionFile)) {
		return fs.readFileSync(versionFile).toString().trim();
	}
}

/**
 * remove version file
 */
function removeVersion() {
	var versionFile = getVersionFile();
	debug('remove version %s',versionFile);
	if (fs.existsSync(versionFile)) {
		fs.unlinkSync(versionFile);
	}
}

/**
 * return the platform specific install binary path
 */
function getInstallBinary (opts, theversion) {
	opts = opts || {};
	// first check and see if specified on command line as option
	var version = theversion || (opts.version!==true ? opts.version : null) || '',
		installDir = getInstallDir(),
		bin = path.join(installDir, version, 'package', 'bin', 'appc'),
		pkg;

	if (fs.existsSync(bin)) {
		// check the package.json since we will delete it on an interrupted download attempt
		pkg = path.join(installDir, version, 'package', 'package.json');
		return fs.existsSync(pkg) && bin;
	}
	else if (theversion) {
		// if we specified a version and we didn't find it, return null
		return null;
	}
	else if (fs.existsSync(installDir)) {
		// try and resolve the latest
		try {
			var dirs = fs.readdirSync(installDir);
			if (dirs.length) {
				if (dirs.length > 1) {

					// see if we have a version set
					theversion = getActiveVersion();
					if (theversion) {
						bin = getInstallBinary(opts, theversion);
						if (!bin) {
							if (!opts.version) {
								debug("you have specified a version (%s) that isn't found",theversion);
								// only warn if we're not asking for this version
								// invalid version specified in version file. remove it and then re-install from latest
								console.log(chalk.red('version '+theversion+' specified previously is no longer available.'));
							}
							removeVersion();
						}
						else {
							return bin;
						}
					}

					// attempt to sort by latest version
					dirs = dirs.filter(function(e){ return e!=='.version'; }).sort(function(a,b){
						var av = parseInt(a.replace(/\./g,'')),
							bv = parseInt(b.replace(/\./g,''));
						return bv - av;
					});
				}
				debug('found the following version directories: %j',dirs);
				for (var c=0;c<dirs.length;c++) {
					bin = path.join(installDir, dirs[c], 'package', 'bin', 'appc');
					if (fs.existsSync(bin)) {
						// check the package.json since we will delete it on an interrupted download attempt
						pkg = path.join(installDir, dirs[c], 'package', 'package.json');
						return fs.existsSync(pkg) && bin;
					}
				}
			}
		}
		catch (E) {
			debug('error reading install directory %o',E);
			if (E.code==='EACCES') {
				var message = process.platform==='win32' ? 'Please make sure you change the permissions and re-try' : 'Please make sure you change the permissions using these commands:\n\n\t'+chalk.yellow('sudo chown -R '+process.env.USER+' '+installDir+'\n\tchmod -R 0700 '+installDir)+'\n';
				fail('Ooops! Your install directory ('+installDir+') is not writable.\n'+message);
			}
			fail(E);
		}
	}
}

/**
 * given a full path, makes sure that the directory exists
 */
function ensureDir (dir) {
	var last = expandPath(dir),
		parts = [];
	// find the top of the root that exists
	do  {
		parts.unshift(path.basename(last));
		last = path.join(last, '..');
	} while (!fs.existsSync(last));

	if (!fs.existsSync(last)) {
		fs.mkdirSync(last);
	}

	// now create the directories in order
	for (var c=0;c<parts.length;c++) {
		var fp = path.join(last, parts[c]);
		if (!fs.existsSync(fp)) {
			fs.mkdirSync(fp);
		}
		last = fp;
	}

	return dir;
}

/**
 * expand ~ in fn
 */
function expandPath (fn) {
	var home = getHomeDir(),
		p = fn.replace(/~\/?/g, function(value) {
			if (/\/$/.test(value)) {
				return home + '/';
			}
			return home;
		});
	return p;
}

/**
 * fail and properly exit
 */
function fail (msg) {
	stopSpinner();
	debug('fail %o',msg);
	if (msg.stack && process.env.DEBUG) {
		console.error(msg.stack);
	}
	console.error('\n'+(chalk.red(msg.message || msg)));
	process.exit(1);
}

var optionRE = /^-{1,2}([\w-_]+)=?(.*)?$/;

/**
 * very loose parsing of options
 */
function parseOpts() {
	var args = {};
	for (var c=2;c<process.argv.length;c++) {
		var arg = process.argv[c];
		if (optionRE.test(arg)) {
			var match = optionRE.exec(arg),
				name = match[1],
				value = match.length > 2 && match[2] || (process.argv[c+1] && !/^--/.test(process.argv[c+1]) ? process.argv[c+1] : null) || true;
			if (value==='true' || value==='false') {
				value = value==='true';
			}
			if (name.indexOf('no-') === 0) {
				name = name.substring(3);
				value = false;
			}
			args[name] = value;
		}
	}
	return args;
}

/**
 * loose parse none options
 */
function parseArgs(opts) {
	if (!opts) throw new Error("missing opts");
	var args = [];
	for (var c=2;c<process.argv.length;c++) {
		var arg = process.argv[c];
		if (optionRE.test(arg)) {
			var match = optionRE.exec(arg),
				name = match[1],
				value = opts[name];
			// see if a value was provided and if so, remove it too
			if (value && String(process.argv[c+1]===String(value))) {
				c++;
			}
			continue;
		}
		else {
			args.push(arg);
		}
	}
	return args;
}

/**
 * make a registry url
 */
function makeURL (opts, urlpath) {
	if (typeof(opts)==='string') {
		urlpath = opts;
		opts = {};
	}
	else {
		opts = opts || {};
	}
	var baseurl = opts.registry || process.env.APPC_REGISTRY || DEFAULT_REGISTRY_URL;
	return urllib.resolve(baseurl,urlpath);
}

function makeRequestError(msg, code) {
	var err = new Error(msg);
	err.code = code;
	return err;
}

// var DEFAULT_REGISTRY_URL = 'https://9bcfd7d35d3f2ad0ad069665d0120b7a381f81e9.cloudapp.appcelerator.com';
var DEFAULT_REGISTRY_URL = 'https://8d2938f67044d8367d468453b5a6c2536185bcea.cloudapp-enterprise-preprod.appctest.com';

/**
 * return the appc-request-ssl library with our registry fingerprint
 */
function getRequest() {
	return require('appc-request-ssl');
}

/**
 * make a request to location url
 */
function request (location, callback) {
	var url = urllib.parse(location),
		userAgent = 'Appcelerator CLI/'+require('../package').version+' ('+process.platform+')',
		opts = {
			url: url,
			headers: {
				'user-agent': userAgent,
				host: url.host
			}
		},
		req = getRequest().get(opts);

	debug('request %j',opts);

	// start the request
	req.on('response', function(res) {
		debug('request response received');
		callback(null, res, req);
	});

	// check the error
	req.on('error',function(err){
		debug('request error',err);
		if (err.code === 'ECONNREFUSED') {
			return callback(makeRequestError("Error connecting to "+url.host+". Make sure you are online.",err.code));
		}
		else if (err.code === 'ENOTFOUND') {
			return callback(makeRequestError("Error connecting to "+url.host+" (not found). Make sure you are online.",err.code));
		}
		else if (err.code === 'ECONNRESET') {
			return callback(makeRequestError("Error connecting to "+url.host+" (reset). Make sure you are online.",err.code));
		}
		return callback(err);
	});
	
	req.end();

	return req;
}

/**
 * make a request a return JSON
 */
function requestJSON(location, callback) {
	return request(location, function(err,res,req){
		if (err) { return callback(err); }
		if (res.statusCode===200) {
			var buf = '';
			res.on('data', function (chunk) {
				buf+=chunk;
			});
			res.on('end', function(){
				debug('attempting to parse JSON => [%s]',buf);
				callback(null, JSON.parse(buf));
			});
			res.on('error',callback);
		}
		else if (res.statusCode===301 || res.statusCode===302) {
			return requestJSON(res.headers.location, callback);
		}
		else if (res.statusCode===404) {
			return callback(new Error(location+" not found."));
		}
		else {
			return callback(new Error("Invalid response code: "+res.statusCode+" received from server."));
		}
	});
}

/**
 * right pad a string to a specific length
 */
function pad(str, len) {
	var slen = chalk.stripColor(str).length;
	var newstr = str;
	for (var c=slen;c<len;c++) {
		newstr+=' ';
	}
	return newstr;
}

/**
 * returns true if directory is writable by user
 */
function canWriteDir(dir) {
	var del = !fs.existsSync(dir),
		fn;
	try {
		if (del) {
			ensureDir(dir);
		}
		if (fs.statSync(dir).isDirectory()) {
			// create a temp file -- seems like the best way to handle cross platform
			fn = path.join(dir, String(+new Date())+(Math.random()*3)+'.txt');
			// console.log(fn);
			fs.writeFileSync(fn,'hi');
			return true;
		}
		else {
			// not a directory but a file, sorry...
			return false;
		}
	}
	catch (E) {
		if (E.code==='EACCES') {
			return false;
		}
		console.log(E.stack, E.code);
	}
	finally {
		if (fs.existsSync(fn)) {
			try { fs.unlinkSync(fn); } catch (ig) {}
		}
		if (del) {
			try { fs.unlinkSync(path); } catch (ig) {}
		}
	}
}

/**
 * if not writable, returns a message otherwise undefined
 */
function checkDirectory(dir, name) {
	var message;
	if (!canWriteDir(dir)) {
		message = process.platform==='win32' ? 'Please make sure you change the permissions and re-try' : 'Please make sure you change the permissions using these commands:\n\n\t'+chalk.yellow('sudo chown -R '+process.env.USER+' '+dir+'\n\tchmod -R 0700 '+dir)+'\n';
		return errorlib.createError('com.appcelerator.install.preflight.directory.unwritable',name,dir,message);
	}
	else {
		// check the ownership of the directory too
		if (process.platform!=='win32') {
			var stat = fs.statSync(dir);
			if (stat.uid!==process.getuid()) {
				message = 'Please make sure you change the permissions using these commands:\n\n\t'+chalk.yellow('sudo chown -R '+process.env.USER+' '+dir+'\n\tchmod -R 0700 '+dir)+'\n';
				return errorlib.createError('com.appcelerator.install.preflight.directory.ownership',name,dir,process.env.USER,message);
			}
		}
	}
}

// because you can never get enough opportunities to use emojis ... ✊
var whyYouDoAbort = isWindows() ? [':<'] : ['😡','😨','😥','😭','😱','😰','😤','😠'];
function abortMessage (name) {
	// clear line and reset it
	if (process.stdout.isTTY) {
		stopSpinner();
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
	}
	console.log(name+' aborted ... '+(whyYouDoAbort[Math.floor(Math.round(Math.random()*whyYouDoAbort.length))] || whyYouDoAbort[0]));
	process.exit(1);
}

function readConfig () {
	var cf = getConfigFile();
	if (!fs.existsSync(cf)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(cf).toString());
}

function writeConfig(config) {
	var cf = getConfigFile();
	fs.writeFileSync(cf, JSON.stringify(config,null,2));
}

/**
 * perform an update check to see if we have a new version
 *
 * however, some rules:
 *
 * - don't check each time
 * - if specifying a version, skip
 * - if specifying --quiet, skip
 * - if no config, skip
 * - if any failure in checking, skip
 * - only do it once per day (or what is configured)
 *
 */
function updateCheck(opts, callback) {
	// we are specifying a version or we want quiet output, skip
	if (opts.version || opts.quiet) { return callback(); }

	// check to see if we have a config file and if we don't that's OK, return
	// since we are in a setup/install
	var config = readConfig();

	if (!config) {
		return callback();
	}

	try {
		var check = config.lastUpdateCheck;
		var checkEveryMS = config.updateCheckInterval || 86400000; // once per day in MS
		if (!check || check + checkEveryMS < Date.now()) {
			// do the check below
			debug('update check skipping, %d, %d', check, checkEveryMS);
		}
		else {
			// don't do the check
			return callback();
		}
	}
	catch (E){
		// ignore errors, they will be dealt with otherwise
		return callback();
	}

	var url = makeURL(opts, '/list-appc');
	requestJSON(url, function(err,result){
		// skip failures
		if (!err && result) {
			try {
				debug('update check completed, latest is %s',result.latest);
				// set the update check timestamp
				config.lastUpdateCheck = Date.now();
				// write out our config
				writeConfig(config);
				// see if we have it already
				var found = getInstallBinary(opts, result.latest);
				// if not, inform the user of the update
				debug('update check found %s',found);
				if (!found) {
					console.log('A new update '+chalk.yellow('('+result.latest+')')+' is available... Download with '+chalk.green('appc use '+result.latest));
				}
			}
			catch (E) {
			}
		}
		callback();
	});
}

function isWindows() {
	return process.platform === 'win32';
}

/**
 * if a TTY is connected, clear all text on the line and reset the
 * cursor to the beginning of the line
 */
function resetLine () {
	if (process.stdout.isTTY) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
	}
}

/**
 * rmdirSyncRecursive method borrowed from wrench
 *
 * The MIT License
 *
 * Copyright (c) 2010 Ryan McGrath
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
function rmdirSyncRecursive(_path, failSilent) {
	var files;

	try {
		files = fs.readdirSync(_path);
	} catch (err) {

		if(failSilent) return;
		throw new Error(err.message);
	}

	/*  Loop through and delete everything in the sub-tree after checking it */
	for(var i = 0; i < files.length; i++) {
		var file = path.join(_path, files[i]);
		var currFile = fs.lstatSync(file);

		if(currFile.isDirectory())  {
			// Recursive function back to the beginning
			rmdirSyncRecursive(file);
		} else if(currFile.isSymbolicLink()) {
			// Unlink symlinks
			if (isWindows()) {
				fs.chmodSync(file, 666); // Windows needs this unless joyent/node#3006 is resolved..
			}

			fs.unlinkSync(file);
		} else {
			// Assume it's a file - perhaps a try/catch belongs here?
			if (isWindows) {
				fs.chmodSync(file, 666); // Windows needs this unless joyent/node#3006 is resolved..
			}

			fs.unlinkSync(file);
		}
	}

	/*  Now that we know everything in the sub-tree has been deleted, we can delete the main
	 directory. Huzzah for the shopkeep. */
	return fs.rmdirSync(_path);
}


exports.getAppcDir = getAppcDir;
exports.getHomeDir = getHomeDir;
exports.getCacheDir = getCacheDir;
exports.getConfigFile = getConfigFile;
exports.getNpmCacheDirectory = getNpmCacheDirectory;
exports.ensureDir = ensureDir;
exports.expandPath = expandPath;
exports.getInstallDir = getInstallDir;
exports.getInstallBinary = getInstallBinary;
exports.fail = fail;
exports.parseOpts = parseOpts;
exports.parseArgs = parseArgs;
exports.writeVersion = writeVersion;
exports.getActiveVersion = getActiveVersion;
exports.makeURL = makeURL;
exports.request = request;
exports.requestJSON = requestJSON;
exports.pad = pad;
exports.waitMessage = waitMessage;
exports.okMessage = okMessage;
exports.infoMessage = infoMessage;
exports.stopSpinner = stopSpinner;
exports.startSpinner = startSpinner;
exports.canWriteDir = canWriteDir;
exports.checkDirectory = checkDirectory;
exports.abortMessage = abortMessage;
exports.updateCheck = updateCheck;
exports.isWindows = isWindows;
exports.resetLine = resetLine;
exports.rmdirSyncRecursive = rmdirSyncRecursive;
exports.getRequest = getRequest;
