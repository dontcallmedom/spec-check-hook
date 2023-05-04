/**
 * Tests the Github wrapper library.
 */
/* global describe, it, before, after */

const { baseDirUrl } = require('../lib/util');
const Github = require('../lib/github');
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

let github;

describe("The PR Parser", () => {
  before(() => {
    setGlobalDispatcher(agent);
    agent.disableNetConnect();
    github = new Github(GH_TOKEN);
  });

  it("finds a PR preview link for a non-WHATWG single-page spec", async () => {
    ghMock.pr(testRepo, prNumber, testPreviewLink, "test.bs");
    const spec = await github.parsePR(testRepo, prNumber,  webrefPath);
    assert.deepEqual(spec?.nightly?.url, testPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/single-page");
  });

  it("finds a PR preview link for a WHATWG single-page spec", async () => {
    ghMock.pr(testWhatwgRepo, prNumber, testWhatwgPreviewLink, "test.html");
    const spec = await github.parsePR(testWhatwgRepo, prNumber, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgPreviewLink);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/whatwg-single-page");
  });

  it("finds a PR preview link for a WHATWG multi-page spec", async () => {
    ghMock.pr(testWhatwgMultiRepo, prNumber, testWhatwgMultiPreviewLinks, "source");
    const spec = await github.parsePR(testWhatwgMultiRepo, prNumber, webrefPath);
    assert.deepEqual(spec?.nightly?.url, testWhatwgMultiPreviewLinks[0]);
    assert.deepEqual(spec?.nightly?.origUrl, "https://example.com/multi-page/");
    assert.deepEqual(spec?.nightly?.pages?.length, testWhatwgMultiPreviewLinks.length - 1);
  });
  it("throws an error when no PR preview link exists", async () => {
    ghMock.pr(testRepo, prNumber, "", "test.bs");
    try {
      const spec = await github.parsePR(testRepo, prNumber, webrefPath);
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
