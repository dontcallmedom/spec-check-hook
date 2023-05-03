/**
 * Tests the PR parser library.
 */
/* global describe, it, before, after */

const { baseDirUrl } = require('../lib/util');
const { parsePR } = require('../lib/parse-pr');
const  assert = require("assert");
const { MockAgent, setGlobalDispatcher } = require('undici');

const GhMock = require("./gh-api-mock");

const agent = new MockAgent();

const ghMock = new GhMock(agent);

const webrefPath = "./test/webref";
const GH_TOKEN = "testToken";

const testRepo = "acme/repo";
const testWhatwgRepo = "whatwg/reponame";
const testWhatwgMultiRepo = "whatwg/reponame-multi";

const prNumber = 42;

const testPreviewLink = `https://pr-preview.s3.amazonaws.com/foo/repo/pull/${prNumber}.html`;
const testWhatwgPreviewLink = `https://whatpr.org/reponame/${prNumber}.html`;
const testWhatwgMultiPreviewLinks = [`https://whatpr.org/reponame-multi/${prNumber}/subpage.html`, `https://whatpr.org/reponame-multi/${prNumber}/subpage2.html`];
const testWhatwgMultiPreviewIndex = `https://whatpr.org/reponame-multi/${prNumber}/index.html`;

describe("The PR Parser", () => {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
  });

  it("finds a PR preview link for a non-WHATWG single-page spec", async () => {
    ghMock.pr(testRepo, prNumber, testPreviewLink, "test.bs");
    const spec = await parsePR(testRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/single-page");
  });

  it("finds a PR preview link for a WHATWG single-page spec", async () => {
    ghMock.pr(testWhatwgRepo, prNumber, testWhatwgPreviewLink, "test.html");
    const spec = await parsePR(testWhatwgRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/whatwg-single-page");
  });

  it("finds a PR preview link for a WHATWG multi-page spec", async () => {
    ghMock.pr(testWhatwgMultiRepo, prNumber, testWhatwgMultiPreviewLinks, "source");
    const spec = await parsePR(testWhatwgMultiRepo, prNumber, GH_TOKEN, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgMultiPreviewLinks[0]);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/multi-page/");
    assert.deepEqual(spec?.nightly?.pages?.length, testWhatwgMultiPreviewLinks.length - 1);
  });
  it("throws an error when no PR preview link exists", async () => {
    ghMock.pr(testRepo, prNumber, "", "test.bs");
    try {
      const spec = await parsePR(testRepo, prNumber, GH_TOKEN, webrefPath);
    } catch (e) {
      assert(true, "Error thrown: " + e);
      return;
    }
    assert(false, "No error thrown when one was expected");
  });

  after(async () => {
    await agent.close();
  });
});
