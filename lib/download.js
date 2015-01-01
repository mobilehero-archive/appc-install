var ProgressBar = require('../vendor/progress'),
	chalk = require('../vendor/chalk'),
	util = require('./util'),
	urllib = require('url'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	tmpdir = os.tmpdir(),
	MAX_RETRIES = 5,
	pendingRequest;

function download(force, wantVersion, tmpfile, stream, location, callback, nobanner, retryAttempts) {
	if (!nobanner && !wantVersion) { util.waitMessage('Finding latest version ...'); }
	if (!nobanner && wantVersion) { util.waitMessage('Finding version '+wantVersion+' ...'); }
	retryAttempts = retryAttempts || 1;
	pendingRequest = util.request(location, function(err,res,req){
		if (err) {
			if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
				pendingRequest = null;
				return setTimeout(function() {
					download(force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts+1);
				},5000);
			}
			return callback(err);
		}
		// console.log(res);
		if (res.statusCode===301 || res.statusCode===302) {
			// handle redirect
			location = res.headers.location;
			pendingRequest = null;
			return download(tmpfile, stream, location, callback, nobanner);
		}
		else if (res.statusCode===404) {
			pendingRequest = null;
			return callback(new Error("invalid version specified"));
		}
		else if (res.statusCode===200) {
			var version = res.headers['x-appc-version'],
				shasum = res.headers['x-appc-shasum'],
				hash = require('crypto').createHash('sha1');

			hash.setEncoding('hex');

			if (!nobanner && !wantVersion) { util.okMessage(chalk.green(version)); }
			if (!nobanner && wantVersion) { util.okMessage(); }

			// check to see if we have it already installed and if we do, just continue
			if (!force && version) {
				var bin = util.getInstallBinary(null, version);
				if (bin) {
					return callback(null, null, version, bin);
				}
			}

			var total = parseInt(res.headers['content-length'], 10);

			if (!total) {
				return callback(new Error("Received invalid response. content-length was not set."));
			}

			var bar = new ProgressBar('Downloading [:bar] :percent :etas', {
					complete: chalk.green('▤'),
					incomplete: chalk.gray(' '),
					width: Math.max(40, Math.round(process.stdout.columns/2)),
					total: total,
					clear: true
				}),
				count = 0;

			util.stopSpinner();

			res.on('data', function (chunk) {
				if (chunk.length) {
					bar.tick(chunk.length);
					stream.write(chunk);
					hash.update(chunk);
					count+=chunk.length;
				}
			});

			res.on('error', function(err){
				try {
					stream.end();
				}
				catch (E) {
				}
				pendingRequest = null;
				callback(err);
			});

			res.on('end', function () {
				stream.end();
				pendingRequest = null;
				// check to make sure we downloaded all the bytes we needed too
				// if not, this means the download failed and we should attempt to re-start it
				if (count !== total) {
					bar.terminate();
					stream.end();
					if (retryAttempts >= MAX_RETRIES) {
						return callback(new Error("Download failed after "+retryAttempts+" failed re-attempts. Please re-try your install again in a few moments. If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com."));
					}
					// re-open stream
					stream = fs.createWriteStream(tmpfile);
					var delay = retryAttempts * 2000;
					// download failed, we should re-start
					return setTimeout(function(){
						download(force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts+1);
					},delay);
				}
				hash.end();
				var checkshasum = hash.read();
				// our downloaded file checksum should match what we uploaded, if not, this is a security violation
				if (checkshasum!==shasum) {
					return callback(new Error("Invalid file download checksum. This could be a result of the file being modified in transit or it could be because the download was interrupted or had an error. Expected: "+shasum+", was: "+checkshasum+". Please re-try this install again."));
				}
				else {
					util.infoMessage('Validating security checksum '+chalk.green('✓'));
				}
				process.nextTick(function(){
					callback(null, tmpfile, version);
				});
			});
		}
		else if (res.statusCode===500 || res.statusCode===503) {
			// some sort of error on the server, let's re-try again ...
			// 500 is a server error
			// 503 is a server unavailable. this could be a deployment in progress
			stream.end();
			pendingRequest = null;
			if (retryAttempts >= MAX_RETRIES) {
				return callback(new Error("Download server is not currently available. Please re-try your install again in a few moments. If you continue to have this problem, please contact Appcelerator Support at support@appcelerator.com."));
			}
			var delay = retryAttempts * 2000;
			stream = fs.createWriteStream(tmpfile);
			return setTimeout(function() {
				download(force, wantVersion, tmpfile, stream, location, callback, true, retryAttempts+1);
			},delay);
		}
		else {
			pendingRequest = null;
			callback(new Error("Unexpected response returned from server ("+res.statusCode+"). Please re-try your install again."));
		}
	});
}

exports.start = function(force, location, wantVersion, callback) {
	var tmpfile = path.join(tmpdir, 'appc-'+(+new Date())+'.tar.gz'),
		stream = fs.createWriteStream(tmpfile),
		exitFn,
		sigintFn,
		pendingAbort,
		createCleanup = function createCleanup(name) {
			return function(exit) {
				if (pendingRequest) {
					try {
						// abort the pending HTTP request so it will
						// close the server socket
						pendingRequest.abort();
					}
					catch (E) {
					}
					pendingRequest = null;
				}
				try {
					if (fs.existSync(tmpfile)) {
						fs.unlinkSync(tmpfile);
					}
				}
				catch (E) {
				}
				if (name==='SIGINT') {
					pendingAbort = true;
					process.removeListener('SIGINT',sigintFn);
					util.abortMessage('Download');
				}
				else if (name==='exit') {
					process.removeListener('exit',exitFn);
					if (!pendingAbort) {
						process.exit(exit);
					}
				}
				else {
					process.removeListener('exit',exitFn);
					process.removeListener('SIGINT',sigintFn);
				}
			};
		};

	// make sure we remove the file on shutdown
	process.on('exit', (exitFn=createCleanup('exit')));
	process.on('SIGINT', (sigintFn=createCleanup('SIGINT')));

	// run the download
	download(force, wantVersion, tmpfile, stream, location, function(){
		// remove clean listeners
		createCleanup('done')();
		// carry on... 🙏
		return callback.apply(null,arguments);
	});
};
