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
function run (installBin, additionalArgs, cb, dontexit) {
	var spawn = require('child_process').spawn,
		path = require('path'),
		util = require('./util');

	// append any incoming program args
	var args = [ installBin ].concat(process.argv.splice(2));

	// add any additional args
	if (additionalArgs) {
		args = args.concat(additionalArgs);
	}

	// get the environment
	var env = process.env;

	// setup our node environment by first appending our appc node_modules 
	env.NODE_PATH = path.resolve(path.join(path.dirname(installBin),'..','node_modules')) + path.delimiter + 
					// and then our global cache directory
					path.join(util.getCacheDir(),'node_modules') + path.delimiter + 
					// then pickup any paths already setup in our env
					(env.NODE_PATH || '');

	debug('run with env=%j, args=%o',env,args);

	// create our child process which simply inherits this process stdio
	var child = spawn(process.execPath,args,{env:env, stdio:'inherit'});

	// on exit of child, exit ourselves with same exit code
	child.on('close',function(code){
		if (cb) { cb(code); }
		if (!dontexit) { process.exit(code); }
	});
}

module.exports = run;
