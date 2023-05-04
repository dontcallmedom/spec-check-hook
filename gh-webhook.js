const {Octokit} = require("@octokit/rest");
const http = require('http');
const { Webhooks, createNodeMiddleware } = require("@octokit/webhooks");

const {listRemovedTargets} = require("./lib/list-removed-targets");
const Github = require("./lib/github");
const {formatReport} = require("./lib/format-report");

function serve(GH_TOKEN, GH_SECRET, PORT, WEBREF_PATH) {
  const webhooks = new Webhooks({
    secret: GH_SECRET
  });
  const github = new Github(GH_TOKEN);
  const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

  const server = http.createServer(async function (req, res) {
    if (await middleware(req, res)) return;
    res.writeHead(404);
    res.end();
  }).listen(PORT);
  console.log("serving on " + PORT);
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
      spec =  await github.parsePR(payload.repository.full_name, payload.pull_request.number, WEBREF_PATH);
      if (!spec) {
	return;
      }
      // skip the event if the pull request is older than the current version
      // of the spec, to avoid false positives
      if (spec?.crawlCacheInfo?.lastModified && payload.pull_request.created_at < JSON.stringify(new Date(spec.crawlCacheInfo.lastModified))) {
	return;
      }

      targets = await listRemovedTargets(spec, WEBREF_PATH);
    } catch (err) {
      console.error("Failed to process " + JSON.stringify(payload, null, 2));
      console.trace(err);
      throw(err);
    }

    const existingReport = await github.findReport(payload.repository.full_name, payload.pull_request.number, "removedtargets");
    if (!existingReport) {
      if (targets.length) {
	await github.postComment(payload.repository.full_name, payload.pull_request.number, formatReport(targets, spec));
      }
    } // TODO: update report if one exists and its content differs?
  });

  return server;
}

module.exports = { serve };

if (require.main === module) {
  const {GH_TOKEN, GH_SECRET, port, webref_path} = (() => {
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
  serve(GH_TOKEN, GH_SECRET, port, webref_path);
}
