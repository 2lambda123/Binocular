'use strict';

import { connect } from 'react-redux';
import Chart from './chart.js';

const mapStateToProps = (state /*, ownProps*/) => {
  const reverseCommands = state.visualizations.reverseCommands.state;
  const universalSettings = state.universalSettings;
  return {
    palette: reverseCommands.data.data.palette,
    otherCount: reverseCommands.data.data.otherCount,
    filteredCommits: reverseCommands.data.data.filteredCommits,
    commits: reverseCommands.data.data.commits,
    committers: reverseCommands.data.data.committers,
    commitAttribute: reverseCommands.config.commitAttribute,
    firstCommitTimestamp: reverseCommands.data.data.firstCommitTimestamp,
    lastCommitTimestamp: reverseCommands.data.data.lastCommitTimestamp,
    firstSignificantTimestamp: reverseCommands.data.data.firstSignificantTimestamp,
    lastSignificantTimestamp: reverseCommands.data.data.lastSignificantTimestamp,
    displayMetric: reverseCommands.config.displayMetric,
    selectedAuthors: universalSettings.selectedAuthorsGlobal,
    otherAuthors: universalSettings.otherAuthors,
    mergedAuthors: universalSettings.mergedAuthors,
    chartResolution: universalSettings.chartResolution,
  };
};

const mapDispatchToProps = (/*dispatch , ownProps*/) => {
  return {};
};

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
