'use strict';

import { createAction } from 'redux-actions';
import { select, takeEvery, fork } from 'redux-saga/effects';

import { fetchFactory, timestampedActionFactory } from '../../../../sagas/utils.js';
import { graphQl } from '../../../../utils';
import getBounds from './getBounds';

export const setActiveIssue = createAction('SET_ACTIVE_ISSUE', (i) => i);
export const setFilteredCommits = createAction('SET_FILTERED_COMMITS', (cs) => cs);
export const setFilteredFiles = createAction('SET_FILTERED_FILES', (fs) => fs);

export const requestIssueImpactData = createAction('REQUEST_ISSUE_IMPACT_DATA');
export const receiveIssueImpactData = timestampedActionFactory('RECEIVE_ISSUE_IMPACT_DATA');
export const receiveIssueImpactDataError = createAction('RECEIVE_ISSUE_IMPACT_DATA_ERROR');

export const openCommit = createAction('OPEN_COMMIT');
export const openHunk = createAction('OPEN_HUNK');
export const openFile = createAction('OPEN_FILE');
export const openJob = createAction('OPEN_JOB');

export default function* () {
  yield fork(watchSetActiveIssue);
  yield fork(watchOpenCommit);
  yield fork(watchOpenHunk);
  yield fork(watchOpenJob);
  yield fork(watchOpenFile);

  // keep looking for universal settings changes
  yield fork(watchTimeSpan);
}

function* watchTimeSpan() {
  yield takeEvery('SET_TIME_SPAN', fetchIssueImpactData);
}

export function* watchSetActiveIssue() {
  yield takeEvery('SET_ACTIVE_ISSUE', fetchIssueImpactData);
}

export function* watchOpenCommit() {
  yield takeEvery('OPEN_COMMIT', openByWebUrl);
}

export function* watchOpenHunk() {
  yield takeEvery('OPEN_HUNK', openByWebUrl);
}

export function* watchOpenJob() {
  yield takeEvery('OPEN_JOB', openByWebUrl);
}

export function* watchOpenFile() {
  yield takeEvery('OPEN_FILE', openByWebUrl);
}

function openByWebUrl(action) {
  window.open(action.payload.webUrl);
}

export const fetchIssueImpactData = fetchFactory(
  function* () {
    const state = yield select();
    const activeIssueId = state.visualizations.issueImpact.state.config.activeIssueId;
    const { firstCommit, lastCommit, committers, firstIssue, lastIssue } = yield getBounds();
    const firstCommitTimestamp = Date.parse(firstCommit.date);
    const lastCommitTimestamp = Date.parse(lastCommit.date);
    const viewport = state.visualizations.issueImpact.state.config.viewport || [0, null];

    const firstIssueTimestamp = firstIssue ? Date.parse(firstIssue.createdAt) : firstCommitTimestamp;
    const lastIssueTimestamp = lastIssue ? Date.parse(lastIssue.createdAt) : lastCommitTimestamp;
    let firstSignificantTimestamp = Math.max(viewport[0], Math.min(firstCommitTimestamp, firstIssueTimestamp));
    let lastSignificantTimestamp = viewport[1] ? viewport[1].getTime() : Math.max(lastCommitTimestamp, lastIssueTimestamp);
    const timeSpan = state.visualizations.newDashboard.state.config.chartTimeSpan;
    firstSignificantTimestamp = timeSpan.from === undefined ? firstSignificantTimestamp : new Date(timeSpan.from).getTime();
    lastSignificantTimestamp = timeSpan.to === undefined ? lastSignificantTimestamp : new Date(timeSpan.to).getTime();

    if (activeIssueId === null) {
      return { issue: null };
    }

    return yield graphQl
      .query(
        `query($iid: Int!, $since: Timestamp, $until: Timestamp) {
           issue(iid: $iid) {
             iid
             title
             createdAt
             closedAt,
             webUrl
             commits (since: $since, until: $until) {
               data {
                 sha
                 shortSha
                 messageHeader
                 date
                 webUrl
                 files {
                   data {
                     lineCount
                     hunks {
                       newStart
                       newLines
                       oldStart
                       oldLines
                       webUrl
                     }
                     stats {
                      additions
                      deletions
                     }
                     file {
                       id
                       path
                       webUrl
                       maxLength
                     }
                   }
                 }
                 builds {
                   id
                   createdAt
                   finishedAt
                   duration
                   status
                   webUrl
                   jobs {
                     id
                     name
                     stage
                     status
                     createdAt
                     finishedAt
                     webUrl
                   }
                 }
               }
             }
           }
         }`,
        { iid: activeIssueId, since: firstSignificantTimestamp, until: lastSignificantTimestamp }
      )
      .then((resp) => {
        return resp;
      });
  },
  requestIssueImpactData,
  receiveIssueImpactData,
  receiveIssueImpactDataError
);
