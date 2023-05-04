/**
 * Tests the Github wrapper library.
 */
/* global describe, it, before, after */

const { baseDirUrl } = require('../lib/util');
const Github = require('../lib/github');
const  assert = require("assert");
const { MockAgent, setGlobalDispatcher } = require('undici');

const GhMock = require("./gh-api-mock");

let agent, ghMock;

const webrefPath = "./test/webref";
const GH_TOKEN = "testToken";

const testRepo = "acme/repo";
const testWhatwgRepo = "whatwg/reponame";
const testWhatwgMultiRepo = "whatwg/reponame-multi";

const prNumber = 42;

const login = "gh-tester";

const testPreviewLink = `https://pr-preview.s3.amazonaws.com/foo/repo/pull/${prNumber}.html`;
const testWhatwgPreviewLink = `https://whatpr.org/reponame/${prNumber}.html`;
const testWhatwgMultiPreviewLinks = [`https://whatpr.org/reponame-multi/${prNumber}/subpage.html`, `https://whatpr.org/reponame-multi/${prNumber}/subpage2.html`];
const testWhatwgMultiPreviewIndex = `https://whatpr.org/reponame-multi/${prNumber}/index.html`;

let github;

function setup() {
  agent = new MockAgent();
  ghMock = new GhMock(agent);
  setGlobalDispatcher(agent);
  agent.disableNetConnect();
  github = new Github(GH_TOKEN);
}

async function teardown() {
  assert.deepEqual(ghMock.errors, [], "No GH API mocking errors should have happened");
  agent.assertNoPendingInterceptors();
  await agent.close();
}

describe("The PR Parser", () => {
  before(setup);
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

  after(teardown);
});

describe("The Report Finder", () => {
  before(() => {
    setup();
    ghMock.user(login);
  });
  it("finds an existing comment", async () => {
    const matchingComment = { user: { login }, body: ' data-sc-marker="removedtargets"' };
    ghMock.listComments(testRepo, prNumber, [matchingComment]);
    assert.deepEqual(await github.findReport(testRepo, prNumber, "removedtargets"), matchingComment);
  });

  it("returns undefined when no matching comment exists", async () => {
    ghMock.listComments(testRepo, prNumber, [
      {user: { login }, body: ' another comment' },
      {user: { login: "nottester"}, body: ' data-sc-marker="removedtargets" from a different user' }
    ]);
    assert.deepEqual(await github.findReport(testRepo, prNumber, "removedtargets"), undefined);
  });
  after(teardown);
});

