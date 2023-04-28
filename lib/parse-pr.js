const {Octokit} = require("@octokit/rest");
const specs = require('web-specs');

async function parsePR(repoFullname, number, GH_TOKEN) {
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
    console.error(`Could not find a known spec in repo ${specRepo} path ${specSource}`);
    return;
  }

  // check presence of PR preview link
  const prPreviewLink = `https://pr-preview.s3.amazonaws.com/${repoFullname}/pull/${number}.html`;
  if (pr.body.includes(prPreviewLink)) {
    return {
      spec, link: prPreviewLink
    };
  }
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
  parsePR(process.argv[2], process.argv[3], GH_TOKEN).then(data => console.log(data));
}
