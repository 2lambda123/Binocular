'use strict';

import { handleActions } from 'redux-actions';
import _ from 'lodash';

export default handleActions(
  {
    REQUEST_ISSUE_IMPACT_DATA: state => _.assign({}, state, { isFetching: true }),
    RECEIVE_ISSUE_IMPACT_DATA: (state, action) => {
      return _.merge({}, state, {
        data: action.payload,
        isFetching: false,
        receivedAt: action.meta.receivedAt
      });
    }
  },
  { lastFetched: null, isFetching: null }
);