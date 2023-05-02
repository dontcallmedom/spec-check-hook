const fs = require("fs").promises;
const { expandCrawlResult, crawlSpecs } = require('reffy');
const { baseDirUrl, targetify } = require("./util");

async function listRemovedTargets(spec, webrefPath) {
  // obtain built files with on-line services à la pr-preview
  // find shortname of spec in the current repo process.argv[2]

  const crawledSpecData = JSON.parse(await fs.readFile(`${webrefPath}/ed/ids/${spec.shortname}.json`));
  const crawledSpecIds = crawledSpecData.ids.map(targetify(spec));

  const baseUrl = crawledSpecData.spec.url;

  const crawlResults = await crawlSpecs([spec], {modules: ["ids"]});

  const newSpecIds = crawlResults[0].ids.map(targetify(spec));
  // list ids that have disappeared from latest webref crawl
  const disappearedAnchors = crawledSpecIds.filter(id => !newSpecIds.includes(id));

  // find links that pointed to the said ids in other specs
  const jsonIndex = await fs.readFile(`${webrefPath}/ed/index.json`, "utf-8");
  const index = JSON.parse(jsonIndex);

  const webrefCrawl = await expandCrawlResult(index, `${webrefPath}/ed/`, ['links']);
  const pages = [baseUrl].concat(spec.nightly?.pages?.map(u => u.replace(baseDirUrl(u), baseUrl)) || []);
  const removedTargets = [];
  for (const url of pages) {
    const linkingSpecs = webrefCrawl.results.filter(s => s.links && s.links[url]?.anchors);
    for (const s of linkingSpecs) {
      const brokenLinks = s.links[url].anchors.filter(a => disappearedAnchors.find(d => d.split("#")[1] === a && url.endsWith(d.split("#")[0])));
      if (brokenLinks.length) {
        let specLinks = removedTargets.find(t => t.spec.url === s.url);
        if (!specLinks) {
          specLinks = {"spec": { title: s.title, url: s.url}, "links": []};
          removedTargets.push(specLinks);
        }
        specLinks.links = specLinks.links.concat(brokenLinks.map(a => url + "#" + a));
      }
    }
  }

  return removedTargets;
}

module.exports = { listRemovedTargets };
