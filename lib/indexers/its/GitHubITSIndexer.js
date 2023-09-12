/* eslint-disable no-useless-escape */
'use strict';

const { Octokit } = require('@octokit/rest');
const log = require('debug')('idx:its:github');
const querystring = require('querystring');
const ConfigurationError = require('../../errors/ConfigurationError');

const Issue = require('../../models/Issue.js');
const MergeRequest = require('../../models/MergeRequest.js');

const GITHUB_ORIGIN_REGEX = /(?:git@github.com:|https:\/\/github.com\/)([^\/]+)\/(.*?)(?=\.git|$)/;

function GitHubITSIndexer(repo, reporter) {
  this.repo = repo;
  this.stopping = false;
  this.reporter = reporter;
}

GitHubITSIndexer.prototype.configure = function (config) {
  if (!config) {
    throw ConfigurationError('configuration object has to be set!');
  }

  this.github = new Octokit({
    baseUrl: 'https://api.github.com',
    auth: config?.auth?.token,
  });

  return Promise.resolve();
};

GitHubITSIndexer.prototype.index = function () {
  let owner, repo;
  let omitCount = 0;
  let persistCount = 0;

  return Promise.resolve(this.repo.getOriginUrl())
    .then((url) => {
      if (url.includes('@')) {
        url = 'https://github.com/' + url.split(':')[1];
      }
      const match = url.match(GITHUB_ORIGIN_REGEX);
      if (!match) {
        throw new Error('Unable to determine github owner and repo from origin url: ' + url);
      }

      owner = match[1];
      repo = match[2];

      log('Getting issues for', `${owner}/${repo}`);
      return depaginate.bind(
        this,
        this.github,
        this.github.paginate(this.github.issues.listForRepo, {
          owner,
          repo,
          state: 'all',
          per_page: 100,
        }),
        (count) => {
          this.reporter.setIssueCount(count);
        },
        async (issue) => {
          log('Processing Issue #' + issue.number);

          issue.user.name = (await this.github.users.getByUsername({ username: issue.user.login })).data.name;
          if (issue.assignee !== null) {
            issue.assignee.name = (await this.github.users.getByUsername({ username: issue.assignee.login })).data.name;
          }

          for (let i = 0; i < issue.assignees.length; i++) {
            issue.assignees[i].name = (await this.github.users.getByUsername({ username: issue.assignees[i].login })).data.name;
          }
          if (issue.pull_request === undefined) {
            return Issue.findOneById(issue.id)
              .then((existingIssue) => {
                if (!existingIssue || new Date(existingIssue.updatedAt).getTime() < new Date(issue.updated_at).getTime()) {
                  log('Processing issue #' + issue.iid);
                  return Issue.persist({
                    id: issue.id,
                    iid: issue.number,
                    title: issue.title,
                    description: issue.body,
                    state: issue.state,
                    url: issue.url,
                    closedAt: issue.closed_at,
                    createdAt: issue.created_at,
                    updatedAt: issue.updated_at,
                    labels: issue.labels,
                    milestone: issue.milestone,
                    author: issue.user,
                    assignee: issue.assignee,
                    assignees: issue.assignees,
                    webUrl: issue.html_url,
                  }).then((results) => {
                    const issue = results[0];
                    const wasCreated = results[1];
                    if (wasCreated) {
                      persistCount++;

                      const mentions = [];

                      return depaginate
                        .bind(
                          this,
                          this.github,
                          this.github.paginate(this.github.issues.listEvents, {
                            owner,
                            repo,
                            issue_number: issue.iid,
                            per_page: 100,
                          }),
                          (eventCount) => log('Processing', eventCount, 'events for Issue #' + issue.iid),
                          (event) => {
                            if (event.event === 'referenced' || event.event === 'closed') {
                              mentions.push({
                                commit: event.commit_id,
                                createdAt: event.created_at,
                                closes: event.event === 'closed',
                              });
                            }
                          }
                        )()
                        .then(() => {
                          if (mentions.length > 0) {
                            issue.mentions = mentions;
                            return issue.save();
                          }
                        });
                    }
                  });
                } else {
                  log('Skipping issue #' + issue.iid);
                  omitCount++;
                }
              })
              .then(() => this.reporter.finishIssue());
          } else {
            return MergeRequest.findOneById(issue.id)
              .then((existingMergeRequest) => {
                if (!existingMergeRequest || new Date(existingMergeRequest.updatedAt).getTime() < new Date(issue.updated_at).getTime()) {
                  log('Processing existingMergeRequest #' + issue.iid);
                  return MergeRequest.persist({
                    id: issue.id,
                    iid: issue.number,
                    title: issue.title,
                    description: issue.body,
                    state: issue.state,
                    url: issue.url,
                    closedAt: issue.closed_at,
                    createdAt: issue.created_at,
                    updatedAt: issue.updated_at,
                    labels: issue.labels,
                    milestone: issue.milestone,
                    author: issue.user,
                    assignee: issue.assignee,
                    assignees: issue.assignees,
                    webUrl: issue.html_url,
                  }).then((results) => {
                    const mergeRequest = results[0];
                    const wasCreated = results[1];
                    if (wasCreated) {
                      persistCount++;

                      const mentions = [];

                      return depaginate
                        .bind(
                          this,
                          this.github,
                          this.github.paginate(this.github.issues.listEvents, {
                            owner,
                            repo,
                            issue_number: mergeRequest.iid,
                            per_page: 100,
                          }),
                          (eventCount) => log('Processing', eventCount, 'events for MergeRequest #' + mergeRequest.iid),
                          (event) => {
                            if (event.event === 'referenced' || event.event === 'closed') {
                              mentions.push({
                                commit: event.commit_id,
                                createdAt: event.created_at,
                                closes: event.event === 'closed',
                              });
                            }
                          }
                        )()
                        .then(() => {
                          if (mentions.length > 0) {
                            mergeRequest.mentions = mentions;
                            return mergeRequest.save();
                          }
                        });
                    }
                  });
                } else {
                  log('Skipping MergeRequest #' + issue.iid);
                  omitCount++;
                }
              })
              .then(() => this.reporter.finishIssue());
          }
        }
      )();
    })
    .then(() => {
      log('Persisted %d new issues (%d already present)', persistCount, omitCount);
    });
};

GitHubITSIndexer.prototype.isStopping = function () {
  return this.stopping;
};

GitHubITSIndexer.prototype.stop = function () {
  log('Stopping');
  this.stopping = true;
};

module.exports = GitHubITSIndexer;

function depaginate(github, firstPage, countHandler, handler) {
  return determineItemCount(github, firstPage)
    .then((count) => countHandler(count))
    .then(() => traversePages.bind(this, github, firstPage, handler)());
}

function determineItemCount(github, firstPage) {
  // first get the initial page
  return Promise.resolve(firstPage).then((resp) => {
    // see if there are more pages
    return resp.length;
  });
}

function traversePages(github, firstPage, handler) {
  return Promise.resolve(firstPage).then((resp) => {
    return eachPromised
      .bind(this, resp, handler)()
      .then((result) => {
        if (result === false) {
          log('Handler stopped iteration by returning false');
        }
      });
  });
}

function eachPromised(array, handler, i = 0) {
  if (this.stopping) {
    return Promise.resolve([]);
  }
  if (i >= array.length) {
    return Promise.resolve(array);
  }

  return Promise.resolve(handler(array[i])).then((result) => {
    return !this.stopping && result !== false && eachPromised.bind(this, array, handler, i + 1)();
  });
}