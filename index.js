const {listRemovedTargets} = require("./lib/list-removed-targets");

if (require.main === module) {
  const specSource = process.argv[2];
  const specRepo = process.argv[3];
  const updatedSpecUrl = process.argv[4];
  const webrefPath = process.argv[5];
  listRemovedTargets(specSource, specRepo, updatedSpecUrl, webrefPath).then(list => console.log(list)).catch(err => {
    console.error(`Failed:`);
    console.trace(err);
    process.exit(2);
  });
}
