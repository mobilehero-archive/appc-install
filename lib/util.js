var fs = require('fs'),
	path = require('path'),
	chalk = require('../vendor/chalk'),
	urllib = require('url');

/**
 * return the platform specific HOME directory
 */
function getHomeDir() {
	return process.env.HOME || process.env.USERPROFILE;
}

/**
 * return the global cache directory in the users home folder
 */
function getCacheDir() {
	return path.join(getHomeDir(), '.appcelerator', 'cache');
}

/**
 * return the platform specific install directory
 */
function getInstallDir () { 
	return path.join(getHomeDir(), '.appcelerator', 'install');
}

/**
 * write out the current version file
 */
function writeVersion(version) {
	var versionFile = path.join(getInstallDir(),'.version');
	fs.writeFileSync(versionFile,version);
}

/**
 * return the active version (if specified) or undefined
 */
function getActiveVersion() {
	var versionFile = path.join(getInstallDir(),'.version');
	if (fs.existsSync(versionFile)) {
		return fs.readFileSync(versionFile).toString().trim();
	}
}

/**
 * return the platform specific install binary path
 */
function getInstallBinary (opts, theversion) {
	// first check and see if specified on command line as option
	var version = theversion || opts.version || '',
		installDir = getInstallDir(),
		bin = path.join(installDir, version, 'package', 'bin', 'appc');

	if (fs.existsSync(bin)) {
		return bin;
	}
	else if (theversion) {
		// if we specified a version and we didn't find it, return null
		return null;
	}
	else if (fs.existsSync(installDir)) {
		// try and resolve the latest
		var dirs = fs.readdirSync(installDir);
		if (dirs.length) {
			if (dirs.length > 1) {

				// see if we have a version set 
				theversion = getActiveVersion();
				if (theversion) {
					var bin = getInstallBinary(opts, theversion);
					if (!bin) {
						// invalid version specified in version file. remove it and then re-install from latest
						console.log(chalk.red('version '+theversion+' specified previously is no longer available.'));
						fs.unlinkSync(versionFile);
					}
					else {
						return bin;
					}
				}

				// attempt to sort by latest version
				dirs = dirs.sort(function(a,b){
					if (a < b) return -1;
					if (b > a) return 1;
					return 0;
				});
			}
			for (var c=0;c<dirs.length;c++) {
				bin = path.join(installDir, dirs[c], 'package', 'bin', 'appc');
				if (fs.existsSync(bin)) {
					return bin;
				}
			}
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
		var fp = last = path.join(last, parts[c]);
		if (!fs.existsSync(fp)) {
			fs.mkdirSync(fp);
		}
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
	msg.stack && process.env.DEBUG && console.error(msg.stack);
	console.error(chalk.red(msg.message || msg));
	process.exit(1);
}

/**
 * very loose parsing of options
 */
function parseOpts() {
	var args = {},
		re = /^--([\w-_]+)=?(.*)?$/;
	for (var c=2;c<process.argv.length;c++) {
		var arg = process.argv[c];
		if (re.test(arg)) {
			var match = re.exec(arg),
				name = match[1],
				value = match.length > 2 && match[2] || process.argv[c+1] || true;
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
function parseArgs() {
	var args = [],
		re = /^--/;
	for (var c=2;c<process.argv.length;c++) {
		var arg = process.argv[c];
		if (re.test(arg)) {
			c++;
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
	var baseurl = opts.registry || process.env.APPC_REGISTRY || 'https://9bcfd7d35d3f2ad0ad069665d0120b7a381f81e9.cloudapp.appcelerator.com';
	return urllib.resolve(baseurl,urlpath);
}

/**
 * make a request to location url
 */
function request (location, callback) {
	var url = urllib.parse(location),
		req = (location.indexOf('https:')!==-1 ? require('https') : require('http')).request(url);

	// start the request
	req.on('response', function(res) {
		callback(null, res, req);
	});

	// check the error
	req.on('error',function(err){
		if (err.code === 'ECONNREFUSED') {
			return callback(new Error("Error connecting to "+url.host+". Make sure you are online."));
		}
		return callback(err);
	});
	
	req.end();
}

/**
 * make a request a return JSON
 */
function requestJSON(location, callback) {
	request(location, function(err,res,req){
		if (err) { return callback(err); }
		if (res.statusCode===200) {
			var buf = '';
			res.on('data', function (chunk) {
				buf+=chunk;
			});
			res.on('end', function(){
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

exports.getHomeDir = getHomeDir;
exports.getCacheDir = getCacheDir;
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
