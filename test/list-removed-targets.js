/**
 * Tests the targets removal detection library.
 */
/* global describe, it */

const { baseDirUrl } = require('../lib/util');
const { listRemovedTargets } = require('../lib/list-removed-targets');
const  assert = require("assert");
const {HttpServer} = require("http-server");

const specs = require('./webref/ed/index.json').results;

const updatedSpec = (shortname, url) => {
  const spec = specs.find(s => s.shortname === shortname);
  const updatedSpec = {...spec};
  updatedSpec.nightly = {...spec.nightly};
  updatedSpec.nightly.url = url;
  if (updatedSpec.nightly.pages) {
    updatedSpec.nightly.pages = updatedSpec.nightly.pages.map(u => u.replace(baseDirUrl(u), baseDirUrl(url)));
  }
  return updatedSpec;
};

const server = new HttpServer({
  port: 0,
  logFn: (req, res, err) => {
    // Ignore "not found" errors that some tests generate on purpose
    if (err && err.status !== 404) {
      console.error(err, req.url, req.status);
    }
  }
});

const port = process.env.PORT ?? 8888;

describe('The targets removal detector', function () {
  this.timeout(10000);
  before(() => {
    server.listen(port);
  });

  it('reports an empty list if no target removal is detected', async () => {
    const spec = updatedSpec("single-page", `http://localhost:${port}/test/specs/single-page/index.html`);
    const results = await listRemovedTargets(spec, './test/webref');
    assert.deepEqual(results, []);
  });

  it('reports a target removal in a single page spec', async () => {
    const spec = updatedSpec("single-page", `http://localhost:${port}/test/specs/single-page/removed-anchor.html`);
    const results = await listRemovedTargets(spec, './test/webref');
    assert.deepEqual(results[0].links, ["https://example.com/single-page#valid1"]);
    assert.deepEqual(results.length, 1);
    assert.deepEqual(results[0].spec.url, "https://example.com/specs/linking-spec/");
  });

  it('reports two target removals in a multi page spec', async () => {
    const spec = updatedSpec("multi-page", `http://localhost:${port}/test/specs/multi-page/index.html`);
    const results = await listRemovedTargets(spec, './test/webref');
    assert.deepEqual(results[0].links, ["https://example.com/multi-page/subpage.html#valid1", "https://example.com/multi-page/subpage2.html#valid2"]);
    assert.deepEqual(results.length, 1);
    assert.deepEqual(results[0].spec.url, "https://example.com/specs/linking-spec/");
  });

  after(() => {
    server.close();
  });
});
