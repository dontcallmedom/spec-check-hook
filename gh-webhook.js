const {Octokit} = require("@octokit/rest");
const http = require('http');
const { Webhooks, createNodeMiddleware } = require("@octokit/webhooks");

const {listRemovedTargets} = require("./lib/list-removed-targets");
const {parsePR} = require("./lib/parse-pr");
const {formatReport} = require("./lib/format-report");

function serve(GH_TOKEN, GH_SECRET, PORT, WEBREF_PATH) {
  const webhooks = new Webhooks({
    secret: GH_SECRET
  });
  const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

  const server = http.createServer(async function (req, res) {
    if (await middleware(req, res)) return;
    res.writeHead(404);
    res.end();
  }).listen(PORT);

  webhooks.onError(function (err) {
    console.error('Error:', err.message);
  });

  webhooks.on('pull_request.edited', async function({payload}) {
    // We only deal with edits made on the pull request by pr-preview[bot]
    if (!payload.sender || payload.sender.login !== "pr-preview[bot]") {
      return;
    }
    let targets = [], spec;
    try {
      spec =  await parsePR(payload.repository.full_name, payload.pull_request.number, GH_TOKEN, WEBREF_PATH);
      if (!spec) {
	return;
      }
      targets = await listRemovedTargets(spec, WEBREF_PATH);
    } catch (err) {
      console.error("Failed to process " + JSON.stringify(payload, null, 2));
      console.trace(err);
      throw(err);
    }

    if (targets.length) {
      const octokit = new Octokit({auth: GH_TOKEN});
      await octokit.rest.issues.createComment({
	owner: payload.repository.owner.login,
	repo: payload.repository.name,
	issue_number: payload.pull_request.number,
	body: formatReport(targets, spec)
      });
    }
  });

  return server;
}

module.exports = { serve };

if (require.main === module) {
  const {GH_TOKEN, GH_SECRET, PORT, WEBREF_PATH} = (() => {
    try {
      return require('./config.json');
    } catch (e) {
      return { GH_TOKEN: process.env.GH_TOKEN,
	       GH_SECRET: process.env.GH_SECRET,
	       port: process.env.PORT || 8080,
	       webref_path: process.env.WEBREF_PATH
	     };
    }
  })();
  serve(GH_TOKEN, GH_SECRET, PORT, WEBREF_PATH);
}
