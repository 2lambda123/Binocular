'use strict';

import { handleActions } from 'redux-actions';
import _ from 'lodash';

export default handleActions(
  {
    SET_OVERLAY: (state, action) => _.assign({}, state, { overlay: action.payload }),
    SET_HIGHLIGHTED_ISSUE: (state, action) => _.assign({}, state, { highlightedIssue: action.payload, highlightedCommits: [] }),
    SET_COMMIT_ATTRIBUTE: (state, action) => _.assign({}, state, { commitAttribute: action.payload }),

    COR_SET_VIEWPORT: (state, action) => _.assign({}, state, { viewport: action.payload }),

    COR_RECEIVE_RELATED_COMMITS: (state, action) => {
      return _.assign({}, state, {
        highlightedCommits: action.payload,
      });
    },
  },
  {
    overlay: 'issues',
    highlightedIssue: null,
    highlightedCommits: [],
    commitAttribute: 'count',
    viewport: [0, null],
  }
);
