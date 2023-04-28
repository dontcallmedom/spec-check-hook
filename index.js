const {listRemovedTargets} = require("./lib/list-removed-targets");
const {parsePR} = require("./lib/parse-pr");

if (require.main === module) {

  const GH_TOKEN = (() => {
    try {
      return require('./config.json').GH_TOKEN;
    } catch (err) {
      return process.env.GH_TOKEN;
    }
  })();

  const prURL = process.argv[2];
  const [,repoFullName, prNumber] = prURL.match(/https:\/\/github.com\/([^\/]+\/[^\/]+)\/pull\/([0-9]+)/);
  
  const webrefPath = process.argv[3];
  parsePR(repoFullName, prNumber, GH_TOKEN)
    .then(({spec, link: updatedSpecUrl}) => listRemovedTargets(spec, updatedSpecUrl, webrefPath))
    .then(list => console.log(list)).catch(err => {
      console.error(`Failed:`);
      console.trace(err);
      process.exit(2);
    });
}
