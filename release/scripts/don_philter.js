/* KoLmafia gCLI: don_philter run|help|mall-manager reprice|mall-manager clean */
var upstream = require('./philter.js');
module.exports.main = function main(args) { return upstream.main(args || ''); };
