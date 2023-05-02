/**
 * Tests the PR parser library.
 */
/* global describe, it, before, after */

const { baseDirUrl } = require('../lib/util');
const { parsePR } = require('../lib/parse-pr');
const  assert = require("assert");
const { MockAgent, setGlobalDispatcher } = require('undici');

const agent = new MockAgent();

const webrefPath = "./test/webref";
const GH_TOKEN = "testToken";



function ghAPI(path, payload, method = 'GET') {
  const client = agent.get('https://api.github.com');
  client.intercept({path, method})
    .reply(200, payload,  { headers: { 'content-type': 'application/json' } });
}

function ghPrAPI(repo, pr, body) {
  ghAPI(`/repos/${repo}/pulls/${pr}`, { body });
}

function ghPrPreviewContent(repo, source_path) {
  const prPreview = { source_path };
  const content = Buffer.from(JSON.stringify(prPreview), 'utf-8').toString('base64');
  ghAPI(`/repos/${repo}/contents/.pr-preview.json`, { content });
}
const testRepo = "acme/repo";
const testWhatwgRepo = "whatwg/reponame";
const testWhatwgMultiRepo = "whatwg/reponame-multi";

const prNumber = 42;

const testPreviewLink = `https://pr-preview.s3.amazonaws.com/foo/repo/pull/${prNumber}.html`;
const testWhatwgPreviewLink = `https://whatpr.org/reponame/${prNumber}.html`;
const testWhatwgMultiPreviewLink = `https://whatpr.org/reponame-multi/${prNumber}/index.html`;


describe("The PR Parser", () => {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it("finds a PR preview link for a non-WHATWG single-page spec", async () => {
    ghPrAPI(testRepo, prNumber, `<a href="${testPreviewLink}">Preview</a>`);
    ghPrPreviewContent(testRepo, "test.bs");
    const spec = await parsePR(testRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/single-page");
  });

  it("finds a PR preview link for a WHATWG single-page spec", async () => {
    ghPrAPI(testWhatwgRepo, prNumber, `<a href="${testWhatwgPreviewLink}">Preview</a>`);
    ghPrPreviewContent(testWhatwgRepo, "test.html");
    const spec = await parsePR(testWhatwgRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/whatwg-single-page");
  });

  it("finds a PR preview link for a WHATWG multi-page spec", async () => {
    ghPrAPI(testWhatwgMultiRepo, prNumber, `<a href="${testWhatwgMultiPreviewLink}">Preview</a>`);
    ghPrPreviewContent(testWhatwgMultiRepo, "source");
    const spec = await parsePR(testWhatwgMultiRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgMultiPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/multi-page/");

  });
  it("throws an error when no PR preview link exists", async () => {
    ghPrAPI(testRepo, prNumber, `<a href="">Preview</a>`);
    ghPrPreviewContent(testRepo, "test.bs");
    try {
      const spec = await parsePR(testRepo, prNumber, GH_TOKEN, webrefPath);
    } catch (e) {
      assert(true, "Error thrown: " + e);
      return;
    }
    assert(false, "No error thrown when one was expected");
  });

  after(() => {
    agent.enableNetConnect();
    agent.deactivate();
  });
});
