# Spec Check

This tool builds on top of [pr-preview](https://github.com/tobie/pr-preview) and [webref](https://github.com/w3c/webref/) to detect if a pull request made on a spec repository brings new detectable issues to the said spec.

At the moment, the only check implemented is detecting whether a spec change breaks known incoming links from other specifications.

## Install
```sh
npm install
```

Checkout the [webref](https://github.com/w3c/webref/) repo somewhere the script can access.

Copy `config.json.dist` in `config.json`, and set the following keys:
* `GH_TOKEN` with a Github token with access to repos actions (the tool reads pull request, commits metadata and when used as a webhook, post comments on pull requests)

For using it as a Github webhook, also set the following keys:
* `webref_path` with the path to the webref checkout
* `GH_SECRET` for the secret used to authentify requests coming from Github
* `port` for the port from which the webhook HTTP server will be provided

These can also be set with environment variables `GH_TOKEN` `WEBREF_PATH` `GH_SECRET` `PORT`.

## Run

### CLI
```sh
node cli.js <url_of_pull_request> <webref_path>
```

This writes a JSON report of detected issues on stdout.

### Github Webhook
```sh
node gh-webhook.js
```

Use the resulting URL served by the server as the URL to a Github Webhook (repo- or organization-wide); make sure the payload is sent as `application/json` and that it is configured to send only `pull_request` events (all other events are ignored, so it's best not to send them altogether).

The webhook will then post a comment on pull requests that brings new detectable issues to the said spec
