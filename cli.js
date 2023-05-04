const {listRemovedTargets} = require("./lib/list-removed-targets");
const Github = require("./lib/github");

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
  const github = new Github(GH_TOKEN);
  github.parsePR(repoFullName, prNumber, webrefPath)
    .then(spec => listRemovedTargets(spec, webrefPath))
    .then(list => console.log(list)).catch(err => {
      console.error(`Failed:`);
      console.trace(err);
      process.exit(2);
    });
}
