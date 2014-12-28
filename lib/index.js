// load based on the platform to allow it to override
try {
	module.exports = require('./'+process.platform);
}
catch (e) {
	// this is OK, no platform to load
}

// if the platform library doesn't implement, provide defaults

if (!module.exports.run) {
	module.exports.run = require('./run');
}

if (!module.exports.install) {
	module.exports.install = require('./install');
}

if (!module.exports.use) {
	module.exports.use = require('./use');
}