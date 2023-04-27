const fs = require("fs").promises;
const specs = require('web-specs');
const { expandCrawlResult, crawlSpecs } = require('reffy');

async function listRemovedTargets(specSource, specRepo, updatedSpecUrl, webrefPath) {
  // obtain built files with on-line services à la pr-preview
  // find shortname of spec in the current repo process.argv[2]

  // Figure which spec shortname this matches
  const spec = specs.find(s =>
    s.nightly?.repository === specRepo && s.nightly.sourcePath === specSource
  );

  if (!spec) {
    console.error(`Could not find a known spec in repo ${specRepo} path ${specSource}`);
    return;
  }

  const crawledSpecIds = JSON.parse(await fs.readFile(`${webrefPath}/ed/ids/${spec.shortname}.json`)).ids.map(id => id.split("#")[1]);

  const baseUrl = crawledSpecIds[0].split("#")[0];

  const updatedSpec = {...spec};
  updatedSpec.nightly.url = updatedSpecUrl;
  const crawlResults = await crawlSpecs([updatedSpec], {modules: ["ids"]});
  const newSpecIds = crawlResults[0].ids.map(id => id.split("#")[1]);
  // list ids that have disappeared from latest webref crawl
  const disappearedAnchors = crawledSpecIds.filter(id => !newSpecIds.includes(id));

  // find links that pointed to the said ids in other specs
  const jsonIndex = await fs.readFile(`${webrefPath}/ed/index.json`, "utf-8");
  const index = JSON.parse(jsonIndex);

  const webrefCrawl = await expandCrawlResult(index, `${webrefPath}/ed/`, ['links']);
  const linkingSpecs = webrefCrawl.results.filter(s => s.links && s.links[baseUrl]?.anchors);
  const removedTargets = linkingSpecs.map(s => {
    return {
      spec: { title: s.title, url: s.url},
      links: s.links[baseUrl].anchors.filter(a => disappearedAnchors.includes(a))
    };
  }).filter(s => s.links.length);

  return removedTargets;
}

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
