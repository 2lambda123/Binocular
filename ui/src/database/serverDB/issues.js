'use strict';

import { graphQl, traversePages } from '../../utils';
import _ from 'lodash';
import moment from 'moment/moment';

export default class Issues {
  static getIssueData(issueSpan, significantSpan) {
    const issueList = [];

    const getIssuesPage = (since, until) => (page, perPage) => {
      return graphQl
        .query(
          `
          query($page: Int, $perPage: Int, $since: Timestamp, $until: Timestamp) {
            issues(page: $page, perPage: $perPage, since: $since, until: $until) {
              count
              page
              perPage
              count
              data {
                title
                createdAt
                closedAt
                author{
                  login
                  name
                }
              }
            }
          }`,
          { page, perPage, since, until }
        )
        .then((resp) => resp.issues);
    };

    return traversePages(getIssuesPage(significantSpan[0], significantSpan[1]), (issue) => {
      issueList.push(issue);
    }).then(function () {
      return issueList;
    });
  }

  static getIssueDataOwnershipRiver(issueSpan, significantSpan, granularity, interval) {
    // holds close dates of still open issues, kept sorted at all times
    const pendingCloses = [];

    // issues closed so far
    let closeCountTotal = 0,
      count = 0;

    let next = moment(significantSpan[0]).startOf('day').toDate().getTime();
    const data = [
      {
        date: new Date(issueSpan[0]),
        count: 0,
        openCount: 0,
        closedCount: 0,
      },
    ];

    const getIssuesPage = (since, until) => (page, perPage) => {
      return graphQl
        .query(
          `
    query($page: Int, $perPage: Int, $since: Timestamp, $until: Timestamp) {
      issues(page: $page, perPage: $perPage, since: $since, until: $until) {
        count
        page
        perPage
        count
        data {
          title
          createdAt
          closedAt
        }
      }
    }`,
          { page, perPage, since, until }
        )
        .then((resp) => resp.issues);
    };

    return traversePages(getIssuesPage(significantSpan[0], significantSpan[1]), (issue) => {
      const createdAt = Date.parse(issue.createdAt);
      const closedAt = issue.closedAt ? Date.parse(issue.closedAt) : null;

      count++;

      // the number of closed issues at the issue's creation time, since
      // the last time we increased closedCountTotal
      const closedCount = _.sortedIndex(pendingCloses, createdAt);
      closeCountTotal += closedCount;

      // remove all issues that are closed by now from the "pending" list
      pendingCloses.splice(0, closedCount);

      while (createdAt >= next) {
        const dataPoint = {
          date: new Date(next),
          count,
          closedCount: closeCountTotal,
          openCount: count - closeCountTotal,
        };

        data.push(dataPoint);
        next += interval;
      }

      if (closedAt) {
        // issue has a close date, be sure to track it in the "pending" list
        const insertPos = _.sortedIndex(pendingCloses, closedAt);
        pendingCloses.splice(insertPos, 0, closedAt);
      } else {
        // the issue has not yet been closed, indicate that by pushing
        // null to the end of the pendingCloses list, which will always
        // stay there
        pendingCloses.push(null);
      }
    }).then(() => data);
  }
}
