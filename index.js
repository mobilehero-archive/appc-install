var fs = require('fs'),
	path = require('path'),
	util = require('./lib/util'),
	bin = util.getInstallBinary();

if (!bin) {
	throw new Error("you must run appc setup before you can require this module");
}

// export our module impersonating the module we're delegating to
var pkgdir = path.join(path.dirname(bin),'..');
module.exports = require(pkgdir);
