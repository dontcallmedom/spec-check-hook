const {Octokit} = require("@octokit/rest");
const http = require('http');
const createHandler = require('github-webhook-handler');

const {listRemovedTargets} = require("./lib/list-removed-targets");
const {parsePR} = require("./lib/parse-pr");
const {formatReport} = require("./lib/format-report");

const GH_TOKEN = (() => {
  try {
    return require('./config.json').GH_TOKEN;
  } catch (err) {
    return process.env.GH_TOKEN;
  }
})();

const GH_SECRET = (() => {
  try {
    return require('./config.json').GH_SECRET;
  } catch (err) {
    return process.env.GH_SECRET;
  }
})();

const PORT = (() => {
  try {
    return require('./config.json').port;
  } catch (err) {
    return process.env.PORT;
  }
})() || 8080;

const WEBREF_PATH = (() => {
  try {
    return require('./config.json').webref_path;
  } catch (err) {
    return process.env.WEBREF_PATH;
  }
})();


const handler = createHandler({ path: '/webhook', secret: GH_SECRET });

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location');
  });
}).listen(PORT);

handler.on('error', function (err) {
  console.error('Error:', err.message);
});

handler.on('pull_request', async function({payload}) {
  // We only deal with edits made on the pull request by pr-preview[bot]
  if (payload.action !== "edited" || !payload.sender || payload.sender.login !== "pr-preview[bot]") {
    return;
  }
      let targets = [], spec;
  try {
    spec =  await parsePR(payload.repository.full_name, payload.pull_request.number, GH_TOKEN);

    if (!spec) {
      return;
    }
    targets = await listRemovedTargets(spec, WEBREF_PATH);
  } catch (err) {
    console.error("Failed to process " + JSON.stringify(payload, null, 2));
    console.trace(err);
  }

  if (targets.length) {
    const octokit = new Octokit({auth: GH_TOKEN});
    octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: formatReport(targets, spec.nightly.origUrl)
      });
  }
});
