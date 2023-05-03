const {Octokit} = require("@octokit/rest");
const { baseDirUrl } = require("./util");
const fs = require("fs").promises;

async function parsePR(repoFullname, number, GH_TOKEN, webrefPath) {
  const jsonIndex = await fs.readFile(`${webrefPath}/ed/index.json`, "utf-8");
  const specs = JSON.parse(jsonIndex).results;

  const octokit = new Octokit({auth: GH_TOKEN});

  const [owner, repo] = repoFullname.split("/");

  // get PR info
  const {data: pr} = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: number
  });

  // check repo has pr-preview config
  const { data: fileData } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: '.pr-preview.json'
  });
  const prPreviewConfig = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
  // read pr-preview config for sourcePath
  const specSource = prPreviewConfig.src_file;
  // identify spec based on repo & sourcePath
  const specRepo = `https://github.com/${repoFullname}`;
  const spec = specs.find(s =>
    s.nightly?.repository === specRepo && s.nightly.sourcePath === specSource
  );

  if (!spec) {
    throw new Error(`Could not find a known spec in repo ${specRepo} path ${specSource}`);
  }

  // check presence of PR preview link
  // TODO: find a more reliable check
  let prPreviewLink;
  if (owner === "whatwg") {
    prPreviewLink = `https://whatpr.org/${repo}/${number}`;
    if (pr.body.includes(prPreviewLink + '.html')) {
      prPreviewLink += '.html';
    } else if (pr.body.includes(prPreviewLink + '/')) {
      // multipage case
      prPreviewLink += '/index.html';
    } else {
      prPreviewLink = undefined;
    }
  } else {
    const m = pr.body.match(/https:\/\/pr-preview\.s3\.amazonaws.com\/[^\/]*\/[^\/]*\/pull\/[0-9]+\.html/);
    if (m) {
      prPreviewLink = m[0];
    }
  }
  if (prPreviewLink) {
    const origNightlyUrl = spec.nightly.url;
    spec.nightly.url = prPreviewLink;
    spec.nightly.origUrl = origNightlyUrl;
    if (spec.nightly.pages) {
      spec.nightly.pages = spec.nightly.pages.map(url => url.replace(baseDirUrl(origNightlyUrl), baseDirUrl(prPreviewLink)));
    }
    return spec;
  }
  throw new Error(`Could not find a pr-preview link in PR`);
}

module.exports = { parsePR };

if (require.main === module) {

  const GH_TOKEN = (() => {
    try {
      return require('../config.json').GH_TOKEN;
    } catch (err) {
      return process.env.GH_TOKEN;
    }
  })();
  parsePR(process.argv[2], process.argv[3], GH_TOKEN).then(data => console.log(data)).catch(err => console.trace(err));
}
