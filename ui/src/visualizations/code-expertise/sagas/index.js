import { createAction } from 'redux-actions';
import { select, throttle, fork, takeEvery } from 'redux-saga/effects';
import _ from 'lodash';

import { fetchFactory, timestampedActionFactory, mapSaga } from '../../../sagas/utils.js';

import {
  getAllCommits,
  getCommitsForBranch,
  getCommitHashesForIssue,
  getCommitHashesForFiles,
  getIssueData,
  getAllBuildData,
  addBuildData,
  getBlameModules,
  getBlameIssues,
  getFilesForCommits,
  getPreviousFilenames,
} from './helper.js';

//define actions
export const requestCodeExpertiseData = createAction('REQUEST_CODE_EXPERTISE_DATA');
export const receiveCodeExpertiseData = timestampedActionFactory('RECEIVE_CODE_EXPERTISE_DATA');
export const receiveCodeExpertiseDataError = createAction('RECEIVE_CODE_EXPERTISE_DATA_ERROR');
export const requestRefresh = createAction('REQUEST_REFRESH');
const refresh = createAction('REFRESH');

export const setCurrentBranch = createAction('SET_CURRENT_BRANCH', (b) => b);
export const setActiveIssue = createAction('SET_ACTIVE_ISSUE', (i) => i);
export const setActiveFiles = createAction('SET_ACTIVE_FILES', (f) => f);
export const setMode = createAction('SET_MODE', (m) => m);
export const setDetails = createAction('SET_DETAILS', (d) => d);
export const setFilterMergeCommits = createAction('SET_FILTER_MERGE_COMMITS', (f) => f);
export const setOnlyDisplayOwnership = createAction('SET_ONLY_DISPLAY_OWNERSHIP', (o) => o);

export default function* () {
  yield fetchCodeExpertiseData();
  yield fork(watchRefreshRequests);
  yield fork(watchRefresh);
  yield fork(watchSetCurrentBranch);
  yield fork(watchSetMode);
  yield fork(watchSetActiveIssue);
  yield fork(watchSetActiveFiles);
  yield fork(watchSetFilterMergeCommits);

  //yield fork(...); for every additional watcher function
}

//mapSaga is a helper function from ui > src > sagas > utils.js that just returns
// a function that calls the action creator (in this case refresh)
//throttle ensures that only one refresh action will be dispatched in an interval of 2000ms
function* watchRefreshRequests() {
  yield throttle(2000, 'REQUEST_REFRESH', mapSaga(refresh));
}

//everytime the refresh action is dispatched (by watchRefreshRequests()), the fetchCodeExpertiseData function is called
function* watchRefresh() {
  yield takeEvery('REFRESH', fetchCodeExpertiseData);
}

function* watchSetCurrentBranch() {
  yield takeEvery('SET_CURRENT_BRANCH', mapSaga(requestRefresh));
}

function* watchSetMode() {
  yield takeEvery('SET_MODE', mapSaga(requestRefresh));
}

function* watchSetActiveFiles() {
  yield takeEvery('SET_ACTIVE_FILES', mapSaga(requestRefresh));
}

//every time the user chooses an issue in the config tab, update the displayed data
function* watchSetActiveIssue() {
  yield takeEvery('SET_ACTIVE_ISSUE', mapSaga(requestRefresh));
}

function* watchSetFilterMergeCommits() {
  yield takeEvery('SET_FILTER_MERGE_COMMITS', mapSaga(requestRefresh));
}

//fetchFactory returns a function that calls the specified function*()
// and dispatches the specified actions (requestCodeExpertiseData etc.) at appropriate points
export const fetchCodeExpertiseData = fetchFactory(
  function* () {
    const state = yield select();
    const mode = state.visualizations.codeExpertise.state.config.mode;
    const issueId = state.visualizations.codeExpertise.state.config.activeIssueId;
    const activeFiles = state.visualizations.codeExpertise.state.config.activeFiles;
    //the currentBranch object could be null, therefore ?. is used
    const currentBranch = state.visualizations.codeExpertise.state.config.currentBranch;
    const filterMergeCommits = state.visualizations.codeExpertise.state.config.filterMergeCommits;

    const result = {
      devData: {},
      issue: null,
    };

    if (currentBranch === null || currentBranch === undefined) return result;

    //########### get data from database (depending on mode) ###########

    let dataPromise;

    if (mode === 'issues') {
      if (issueId === null) return result;

      dataPromise = Promise.all([
        getAllCommits(),
        getIssueData(issueId),
        getCommitHashesForIssue(issueId),
        getAllBuildData(),
        getPreviousFilenames(activeFiles, currentBranch),
      ]).then((results) => {
        const allCommits = results[0];
        const issue = results[1];
        const issueCommitHashes = results[2];
        const builds = results[3];
        const prevFilenames = results[4];
        //set current issue
        result['issue'] = issue;
        return [allCommits, issueCommitHashes, builds, prevFilenames];
      });
    } else if (mode === 'modules') {
      if (activeFiles === null || activeFiles.length === 0) return result;

      dataPromise = Promise.all([
        getAllCommits(),
        getCommitHashesForFiles(activeFiles, currentBranch),
        getAllBuildData(),
        getPreviousFilenames(activeFiles, currentBranch),
      ]);
    } else {
      console.log('error in fetchCodeExpertiseData: invalid mode: ' + mode);
      return result;
    }

    return yield dataPromise.then(([allCommits, relevantCommitsHashes, builds, prevFilenames]) => {
      //########### get all relevant commits ###########

      //contains all commits of the current branch
      const branchCommits = getCommitsForBranch(currentBranch, allCommits);

      //we now have all commits for the current branch and all commits for the issue
      //intersect the two groups to get the result set
      //we are interested in commits that are both on the current branch and related to the issue
      let relevantCommits = branchCommits.filter((commit) => {
        //if a commits parent string contains a comma, it has more than one parent -> it is a merge commit
        if (filterMergeCommits && commit.parents.includes(',')) {
          return false;
        }
        return relevantCommitsHashes.includes(commit.sha);
      });

      if (relevantCommits.length === 0) {
        return result;
      }

      //########### add build data to commits ###########
      relevantCommits = addBuildData(relevantCommits, builds);

      //########### extract data for each stakeholder ###########

      //first group all relevant commits by stakeholder
      const commitsByStakeholders = _.groupBy(relevantCommits, (commit) => commit.signature);

      for (const stakeholder in commitsByStakeholders) {
        result['devData'][stakeholder] = {};

        //add commits to each stakeholder
        result['devData'][stakeholder]['commits'] = commitsByStakeholders[stakeholder];

        //initialize linesOwned with 0. If program runs in online mode, this will be updated later
        result['devData'][stakeholder]['linesOwned'] = 0;

        //for each stakeholder, sum up relevant additions
        result['devData'][stakeholder]['additions'] = _.reduce(
          commitsByStakeholders[stakeholder],
          (sum, commit) => {
            if (mode === 'issues') {
              //we are interested in all additions made in each commit
              return sum + commit.stats.additions;
            } else {
              let tempsum = 0;
              //we are interested in the additions made to the currently active files
              //TODO what if the commit touches an old file that has the same name as a current file?
              const relevantActiveFiles = commit.files.data.filter((f) => activeFiles.includes(f.file.path));
              //if at least one exists, return the respective additions
              if (relevantActiveFiles && relevantActiveFiles.length > 0) {
                tempsum += _.reduce(relevantActiveFiles, (fileSum, file) => fileSum + file.stats.additions, 0);
              }

              //also, we want to check if this commit touches previous versions of the active files
              //for each file this commit touches
              commit.files.data.map((f) => {
                const filePath = f.file.path;
                const commitDate = new Date(commit.date);

                //get all objects for previous file names that have the same name as the file we are currently looking at
                //this means that maybe this commit touches a file that was renamed later on
                const prevFileObjects = prevFilenames.filter((pfno) => pfno.oldFilePath === filePath);
                //for each of these file objects (there could be multiple since the file may have been renamed multiple times)
                for (const prevFileObj of prevFileObjects) {
                  //if hasThisNameUntil is null, this means that this is the current name of the file.
                  // since we are at this point only interested in previous files, we ignore this file
                  if (prevFileObj.hasThisNameUntil === null) continue;

                  const fileWasNamedFrom = new Date(prevFileObj.hasThisNameFrom);
                  const fileWasNamedUntil = new Date(prevFileObj.hasThisNameUntil);
                  //if this commit touches a previous version of this file in the right timeframe,
                  // we add the additions of this file to the temporary sum
                  if (fileWasNamedFrom <= commitDate && commitDate < fileWasNamedUntil) {
                    tempsum += f.stats.additions;
                  }
                }
              });

              return sum + tempsum;
            }
          },
          0
        );
      }

      //########### add ownership data to commits ###########

      if (mode === 'issues') {
        console.log("TODO");
        return result;
      } else {
        const latestBranchCommit = branchCommits.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        return getBlameModules(latestBranchCommit, activeFiles).then((res) => {
          for (const [name, val] of Object.entries(res)) {
            result['devData'][name]['linesOwned'] = val;
          }
          return result;
        });
      }
      

      // let ownershipDataPromise;

      // if (mode === 'issues') {
      //   //get latest relevant commit of the branch
      //   const latestRelevantCommit = relevantCommits.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      //   //hashes of all relevant commits
      //   const hashes = relevantCommits.map((commit) => commit.sha);
      //   ownershipDataPromise = Promise.resolve(getFilesForCommits(hashes)).then((files) =>
      //     getBlameIssues(
      //       latestRelevantCommit.sha,
      //       files.map((file) => file.file.path),
      //       hashes
      //     )
      //   );
      // } else {
      //   //get latest commit of the branch
      //   const latestBranchCommit = branchCommits.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      //   ownershipDataPromise = Promise.resolve(getBlameModules(latestBranchCommit.sha, activeFiles));
      // }

      // return ownershipDataPromise
      //   .then((res) => {
      //     ...
      //   });
    });
  },
  requestCodeExpertiseData,
  receiveCodeExpertiseData,
  receiveCodeExpertiseDataError
);
