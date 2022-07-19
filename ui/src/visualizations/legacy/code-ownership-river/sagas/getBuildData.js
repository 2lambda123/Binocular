'use strict';

import moment from 'moment';
import _ from 'lodash';
import { traversePages, graphQl } from '../../../../utils';

export default function getBuildData(buildSpan, significantSpan, granularity, interval) {
  let next = moment(significantSpan[0]).startOf('day').toDate().getTime();
  const data = [
    {
      date: new Date(significantSpan[0]),
      stats: {
        success: 0,
        failed: 0,
        pending: 0,
        canceled: 0,
      },
    },
  ];

  return traversePages(getBuildsPage(significantSpan[0], significantSpan[1]), (build) => {
    const createdAt = Date.parse(build.createdAt);

    while (createdAt >= next) {
      const dataPoint = {
        date: new Date(next),
        stats: _.defaults(
          {
            total: (build.stats.success || 0) + (build.stats.failed || 0) + (build.stats.pending || 0) + (build.stats.canceled || 0),
          },
          build.stats
        ),
      };

      data.push(dataPoint);
      next += interval;
    }
  }).then(() => data);
}

const getBuildsPage = (since, until) => (page, perPage) => {
  return graphQl
    .query(
      `
    query($page: Int, $perPage: Int, $since: Timestamp, $until: Timestamp) {
      builds(page: $page, perPage: $perPage, since: $since, until: $until) {
        count
        page
        perPage
        count
        data {
          id
          createdAt
          stats {
            success
            failed
            pending
            canceled
          }
        }
      }
    }`,
      { page, perPage, since, until }
    )
    .then((resp) => resp.builds);
};
