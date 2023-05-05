const {Octokit} = require("@octokit/rest");
const { baseDirUrl } = require("./util");
const fs = require("fs").promises;
const { JSDOM } = require("jsdom");


class Github {
  constructor(GH_TOKEN) {
    this.octokit =  new Octokit({auth: GH_TOKEN});
  }
  async getUser() {
    if (!this.user) {
      this.user = (await this.octokit.rest.users.getAuthenticated()).data;
    }
    return this.user;

  }
  async parsePR(repoFullname, number, webrefPath) {
    const jsonIndex = await fs.readFile(`${webrefPath}/ed/index.json`, "utf-8");
    const specs = JSON.parse(jsonIndex).results;

    const [owner, repo] = repoFullname.split("/");

    // get PR info
    const {data: pr} = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: number
    });

    // check repo has pr-preview config
    const { data: fileData } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.pr-preview.json'
    });
    const prPreviewConfig = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
    // read pr-preview config for sourcePath
    const specSource = prPreviewConfig.src_file;
    // identify spec based on repo & sourcePath
    const specRepo = `https://github.com/${repoFullname}`;
    const spec = specs.find(s =>
      s.nightly?.repository === specRepo && s.nightly.sourcePath === specSource
    );

    if (!spec) {
      throw new Error(`Could not find a known spec in repo ${specRepo} path ${specSource}`);
    }

    // check presence of PR preview link
    let prPreviewLink, changedPages;
    const { document } = (new JSDOM(pr.body)).window;
    if (owner === "whatwg") {
      prPreviewLink = `https://whatpr.org/${repo}/${number}`;
      const links = [...document.querySelectorAll(`a[href^="${prPreviewLink}"]`)];
      if (links.length === 1 && links[0].href === prPreviewLink + '.html') {
	prPreviewLink = links[0].href;
      } else {
	// multipage document, we need to distinguish preview links from diff links
	const previewLinks = links.filter(a => a.href.startsWith(prPreviewLink + '/') && !a.href.includes("..."));
	if (previewLinks.length) {
	  changedPages = previewLinks.map(a => a.href);
	  // We use the first changed page as the "main" page
	  // to only parse pages that have actually been modified
	  prPreviewLink = changedPages.shift();
	} else {
	  prPreviewLink = undefined;
	}
      }
    } else {
      const m = pr.body.match(/https:\/\/pr-preview\.s3\.amazonaws.com\/[^\/]*\/[^\/]*\/pull\/[0-9]+\.html/);
      if (m) {
	prPreviewLink = m[0];
      }
    }
    if (prPreviewLink) {
      const origNightlyUrl = spec.nightly.url;
      spec.nightly.url = prPreviewLink;
      spec.nightly.origUrl = origNightlyUrl;
      spec.nightly.pages = changedPages;
      return spec;
    }
    throw new Error(`Could not find a pr-preview link in PR`);
  }

  async getBaseCommitDate(repoFullname, commit_sha) {
    const { data: commit } = await this.octokit.rest.git.getCommit({
      owner: repoFullname.split("/")[0],
      repo: repoFullname.split("/")[1],
      commit_sha
    });
    return commit.author.date;
  }

  async findReport(repoFullname, number, marker) {
    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner: repoFullname.split("/")[0],
      repo: repoFullname.split("/")[1],
      issue_number: number
    });
    const user = await this.getUser();
    // NB: we assume the comment would be in the first 30 comments since
    // it should be coming up shortly after the PR is created
    return comments.find(c => c.user.login === user.login && c.body.match(` data-sc-marker="${marker}"`));
  }
  async postComment(repoFullname, number, body) {
    return await this.octokit.rest.issues.createComment({
      owner: repoFullname.split("/")[0],
      repo: repoFullname.split("/")[1],
      issue_number: number,
      body
    });

  }
}

module.exports = Github;

if (require.main === module) {

  const GH_TOKEN = (() => {
    try {
      return require('../config.json').GH_TOKEN;
    } catch (err) {
      return process.env.GH_TOKEN;
    }
  })();
  const github = new Github(GH_TOKEN);
  github.parsePR(process.argv[2], process.argv[3]).then(data => console.log(data)).catch(err => console.trace(err));
}
