/**
 * Tests the Github Webhook server.
 */
/* global describe, it, before, after */

const assert = require("assert");
const fs = require("fs").promises;
const { MockAgent, setGlobalDispatcher } = require('undici');
// We need both undici.MockAgent and nock
// because reffy doesn't use node's fetch yet
const nock = require("nock");
const request = require('supertest');
const GhMock = require("./gh-api-mock");
const { formatReport } = require("../lib/format-report");
const { baseDirUrl } = require("../lib/util");
const webhook = require("../gh-webhook");

const agent = new MockAgent();

const ghMock = new GhMock(agent);

const webrefPath = "./test/webref";
const GH_TOKEN = "testToken";
const GH_SECRET = "TEST HOOK";
const port = process.env.PORT || 8888;

let server, req;

const prNumber = 42;
const testPreviewLink = `https://pr-preview.s3.amazonaws.com/foo/repo/pull/${prNumber}.html`;
const testWhatwgMultiPreviewLinks = [`https://whatpr.org/reponame-multi/${prNumber}/subpage.html`, `https://whatpr.org/reponame-multi/${prNumber}/subpage2.html`];
const testWhatwgMultiPreviewIndex = `https://whatpr.org/reponame-multi/${prNumber}/index.html`;


async function mockPreviewSpec(link) {
  let scope, localPath;
  if (link === testPreviewLink) {
    scope = nock('https://pr-preview.s3.amazonaws.com');
    const localSpec = await fs.readFile("./test/specs/single-page/removed-anchor.html", "utf-8");
    scope.get('/' + link.split('/').slice(3).join('/'))
      .reply(200, localSpec, { headers: {"Content-Type": "text/html; charset=utf-8"} });
    return;
  } else if (link.startsWith(baseDirUrl(testWhatwgMultiPreviewIndex))) {
    const basePath = '/' + baseDirUrl(testWhatwgMultiPreviewIndex).split('/').slice(3).join('/');
    const pages = {};
    for (const page of ["index.html", "subpage.html", "subpage2.html"]) {
      pages[page] = await fs.readFile("./test/specs/multi-page/" + page);
    }
    scope = nock('https://whatpr.org').persist();
    scope.get(path => path.startsWith(basePath))
      .reply(200 ,path => pages[path.replace(basePath, '')]);
  }
}

const editPrPayload = (sender, repoFullname) => {
  return {
    action: "edited",
    number: prNumber,
    repository: {
      full_name: repoFullname,
      name: repoFullname.split("/")[1],
      owner: {
	login: repoFullname.split("/")[0]
      }
    },
    pull_request: {
      number: prNumber
    },
    sender: {
      login: sender
    }
  };
};


function setupRequest(req, payload, event = "pull_request") {
  return req.post('/webhook')
    .set('X-Github-Event', event)
    .set('X-Github-Delivery', 'test')
    .set('X-Hub-Signature-256', ghMock.signPayload("sha256", GH_SECRET, Buffer.from(JSON.stringify(payload)), 'utf-8'))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(payload));
}

function getSpec(shortname) {
  const specs = require("./webref/ed/index.json").results;
  return specs.find(s => s.shortname === shortname);
}

const removedTargets = (links) => {
  return [{
    spec: { "title": "Specs with links", url: "https://example.com/specs/linking-spec/" },
    links: links
  }];
};

describe("the webhook server", function() {
  this.timeout(20000);

  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
    agent.enableNetConnect(`localhost:${port}`);
    server = webhook.serve(GH_TOKEN, GH_SECRET, port, webrefPath);
    req = request(server);
  });

  it("reacts to a PR edit from pr-preview bot on a single page spec", async () => {
    const spec = getSpec("single-page");
    ghMock.pr("acme/repo", prNumber, testPreviewLink, "test.bs");
    ghMock.prComment("acme/repo", prNumber,
		     formatReport(removedTargets(["https://example.com/single-page#valid1"]), spec));
    await mockPreviewSpec(testPreviewLink);
    const payload = editPrPayload("pr-preview[bot]", "acme/repo");
    try {
      const res = await setupRequest(req, payload).expect(200);
    } catch (err) {
      assert(false, err);
    }
    assert.deepEqual(ghMock.errors, []);
  });

  it("reacts to a PR edit from pr-preview bot on a multi page spec, but only on pages listed as changed", async () => {
    const spec = getSpec("multi-page");
    ghMock.pr("whatwg/reponame-multi", prNumber, testWhatwgMultiPreviewLinks, "source");
    ghMock.prComment("whatwg/reponame-multi", prNumber,
		     formatReport(removedTargets(["https://example.com/multi-page/subpage.html#valid1", "https://example.com/multi-page/subpage2.html#valid2"]), spec));
    await mockPreviewSpec(testWhatwgMultiPreviewIndex);
    const payload = editPrPayload("pr-preview[bot]", "whatwg/reponame-multi");
    try {
      const res = await setupRequest(req, payload).expect(200);
    } catch (err) {
      assert(false, err);
    }
    assert.deepEqual(ghMock.errors, [], "No GH API mocking errors should have happened");
  });

  it("ignores other PR edits (not from pr-preview bot)", async () => {
    const payload = editPrPayload("dontcallmedom", "acme/repo");
    try {
      const res = await setupRequest(req, payload).expect(200);
    } catch (err) {
      assert(false, err);
    }
  });

  it("ignores other pull_request events", async () => {
    const payload = editPrPayload("pr-preview[bot]", "acme/repo");
    payload.action = "created";
    try {
      const res = await setupRequest(req, payload).expect(200);
    } catch (err) {
      assert(false, err);
    }
  });

  it("ignores other github events", async () => {
    const payload = editPrPayload("pr-preview[bot]", "acme/repo");
    try {
      const res = await setupRequest(req, payload, "issue").expect(200);
    } catch (err) {
      assert(false, err);
    }

  });

  after(async () => {
    server.close();
    agent.assertNoPendingInterceptors();
    assert.deepEqual(nock.pendingMocks(), []);
    agent.close();
  });
});
