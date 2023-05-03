const crypto = require("crypto");
const assert = require("assert").strict;

class GhMock {
  constructor(agent) {
    this.agent = agent;
    this.errors = [];
  }
  api(path, payload, method = 'GET', reqBody) {
    const client = this.agent.get('https://api.github.com');
    const options = {path, method};
    if (method === "POST" && reqBody) {
      options.body = body => {
	try {
	  const parsedBody = JSON.parse(body);
	  if (parsedBody.body !== reqBody.body) {
	    this.errors.push(`Actual request body ${parsedBody.body} differs from expected request body ${reqBody.body}`);
	  }
	} catch (err) {
	  this.errors.push(err);
	}
	return true;
      };
    }
    client.intercept(options)
      .reply(200, payload,  { headers: { 'content-type': 'application/json' } });
  }

  prAPI(repo, pr, body) {
    this.api(`/repos/${repo}/pulls/${pr}`, { body });
  }

  prPreviewContent(repo, source_path) {
    const prPreview = { source_path };
    const content = Buffer.from(JSON.stringify(prPreview), 'utf-8').toString('base64');
    this.api(`/repos/${repo}/contents/.pr-preview.json`, { content });
  }

  pr(repo, prNumber, previewLinks, sourcePath) {
    previewLinks = Array.isArray(previewLinks) ? previewLinks : [previewLinks];
    this.prAPI(repo, prNumber, `${previewLinks.map(l => `<a href="${l}">Preview</a>`)}`);
    this.prPreviewContent(repo, sourcePath);
  }

  prComment(repo, prNumber, body) {
    this.api(`/repos/${repo}/issues/${prNumber}/comments`, {ok: true}, 'POST', {body});
  }

  signPayload(algo, secret, buffer) {
    return algo + "=" + crypto.createHmac(algo, secret).update(buffer).digest("hex");
  }
}
module.exports = GhMock;
