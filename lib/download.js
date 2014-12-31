var ProgressBar = require('../vendor/progress'),
	chalk = require('../vendor/chalk'),
	util = require('./util'),
	urllib = require('url'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	tmpdir = os.tmpdir();

function download(force, wantVersion, tmpfile, stream, location, callback, nobanner) {
	if (!nobanner && !wantVersion) { util.waitMessage('Finding latest version ...'); }
	if (!nobanner && wantVersion) { util.waitMessage('Finding version '+wantVersion+' ...'); }

	util.request(location, function(err,res,req){
		if (err) { return callback(err); }
		// console.log(res);
		if (res.statusCode===301 || res.statusCode===302) {
			// handle redirect
			location = res.headers.location;
			return download(tmpfile, stream, location, callback, nobanner);
		}
		else if (res.statusCode===404) {
			return callback(new Error("invalid version specified"));
		}
		else if (res.statusCode===200) {
			var version = res.headers['x-appc-version'],
				shasum = res.headers['x-appc-shasum'],
				hash = require('crypto').createHash('sha1');

			hash.setEncoding('hex');

			if (!nobanner && !wantVersion) { util.okMessage(chalk.green(version)); }
			if (!nobanner && wantVersion) { util.okMessage(chalk.green('✓')); }

			// check to see if we have it already installed and if we do, just continue
			if (!force && version) {
				var bin = util.getInstallBinary(null, version);
				if (bin) {
					return callback(null, null, version, bin);
				}
			}

			var len = parseInt(res.headers['content-length'], 10);

			var bar = new ProgressBar('Downloading [:bar] :percent :etas', {
				complete: chalk.green('▤'),
				incomplete: chalk.gray(' '),
				width: Math.max(40, process.stdout.columns/2),
				total: len,
				clear: true
			});

			res.on('data', function (chunk) {
				bar.tick(chunk.length);
				stream.write(chunk);
				hash.update(chunk);
			});

			res.on('error', function(err){
				try {
					stream.end();
				}
				catch (E) {
				}
				try {
					fs.unlinkSync(tmpfile);
				}
				catch (E) {
				}
				callback(err);
			});

			res.on('end', function () {
				stream.end();
				hash.end();
				var checkshasum = hash.read();
				// our downloaded file checksum should match what we uploaded, if not, this is a security violation
				if (checkshasum!==shasum) {
					return callback(new Error("Invalid file download checksum. This could be a result of the file being modified in transit. Expected: "+shasum+", was: "+checkshasum));
				}
				else {
					util.infoMessage('Validating security checksum '+chalk.green('✓'));
				}
				process.nextTick(function(){
					callback(null, tmpfile, version);
				});
			});
		}
		else {
			callback(new Error("invalid response returned from server ("+res.statusCode+")"));
		}
	});
}

exports.start = function(force, location, wantVersion, callback) {
	var tmpfile = path.join(tmpdir, 'appc-'+(+new Date())+'.tar.gz'),
		stream = fs.createWriteStream(tmpfile);

	// make sure we remove the file on shutdown
	process.on('exit', function(){
		util.stopSpinner();
		console.log('\n');
		try {
			fs.unlinkSync(tmpfile);
		}
		catch (E) {
		}
	});

	download(force, wantVersion, tmpfile, stream, location, callback);
};
