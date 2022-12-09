'use strict';

import React from 'react';
import { connect } from 'react-redux';
import styles from '../styles.scss';
import { setResolution, setTimeSpan } from '../sagas';
import DateRangeFilter from '../../../components/DateRangeFilter/dateRangeFilter';
import CheckboxLegend from '../../../components/CheckboxLegend';
import { setSelectedAuthors } from '../sagas';
import { setAllAuthors } from '../sagas';

const mapStateToProps = (state /*, ownProps*/) => {
  const dashboardState = state.visualizations.newDashboard.state;

  let firstDisplayDate = '';
  let lastDisplayDate = '';
  let selectedAuthors = [];

  if (dashboardState.config.chartTimeSpan.from === undefined) {
    firstDisplayDate =
      dashboardState.data.data.firstCommit !== undefined ? dashboardState.data.data.firstCommit.date.split('.')[0] : undefined;
  } else {
    firstDisplayDate = dashboardState.config.chartTimeSpan.from;
  }
  if (dashboardState.config.chartTimeSpan.to === undefined) {
    lastDisplayDate =
      dashboardState.data.data.lastCommit !== undefined ? dashboardState.data.data.lastCommit.date.split('.')[0] : undefined;
  } else {
    lastDisplayDate = dashboardState.config.chartTimeSpan.to;
  }
  if (dashboardState.config.selectedAuthorsGlobal !== undefined) {
    selectedAuthors = dashboardState.config.selectedAuthorsGlobal;
  }

  return {
    chartResolution: dashboardState.config.chartResolution,
    firstDisplayDate: firstDisplayDate,
    lastDisplayDate: lastDisplayDate,
    firstCommit: dashboardState.data.data.firstCommit,
    lastCommit: dashboardState.data.data.lastCommit,
    committers: dashboardState.data.data.committers,
    palette: dashboardState.data.data.palette,
    selectedAuthors: selectedAuthors,
    firstSignificantTimestamp: dashboardState.data.data.firstSignificantTimestamp,
    lastSignificantTimestamp: dashboardState.data.data.lastSignificantTimestamp,
  };
};

const mapDispatchToProps = (dispatch /*, ownProps*/) => {
  return {
    onClickResolution: (resolution) => dispatch(setResolution(resolution)),
    onChangeTimeSpan: (timeSpan) => dispatch(setTimeSpan(timeSpan)),
    onClickCheckboxLegend: (selected) => dispatch(setSelectedAuthors(selected)),
    onSetPalette: (allAuthors) => dispatch(setAllAuthors(allAuthors)),
  };
};

const UniversalConfigComponent = (props) => {
  let otherCommitters;
  if (props.palette && 'others' in props.palette) {
    otherCommitters = props.committers.length - (Object.keys(props.palette).length - 1);
  }
  if (props.palette !== undefined) {
    props.onSetPalette(props.palette);
  }

  function timestampToDateTimeString(timestamp) {
    const date = new Date(timestamp);

    return (
      '' +
      date.getFullYear() +
      '-' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(date.getDate()).padStart(2, '0') +
      'T' +
      String(date.getHours()).padStart(2, '0') +
      ':' +
      String(date.getMinutes()).padStart(2, '0') +
      ':' +
      String(date.getSeconds()).padStart(2, '0')
    );
  }

  return (
    <div>
      <h1 className={styles.headline}>Universal Settings</h1>
      <label className="label">Granularity</label>
      <div className="control">
        <div className="select">
          <select value={props.chartResolution} onChange={(e) => props.onClickResolution(e.target.value)}>
            <option value="years">Year</option>
            <option value="months">Month</option>
            <option value="weeks">Week</option>
            <option value="days">Day</option>
          </select>
        </div>
      </div>
      <label className="label">Date Range</label>
      <div>
        <DateRangeFilter
          from={props.firstDisplayDate}
          to={props.lastDisplayDate}
          onDateChanged={(data) => {
            props.onChangeTimeSpan(data);
          }}
        />
      </div>
      <div className={styles.marginTop05}>
        <button
          className="button"
          onClick={(e) => {
            const defaultTimeSpan = {
              from: timestampToDateTimeString(props.firstSignificantTimestamp),
              to: timestampToDateTimeString(props.lastSignificantTimestamp),
            };
            props.onChangeTimeSpan(defaultTimeSpan);
          }}>
          Reset
        </button>
      </div>
      <label className="label">Authors</label>
      <div>
        <CheckboxLegend
          palette={props.palette}
          onClick={props.onClickCheckboxLegend.bind(this)}
          title="All"
          split={props.metric === 'linesChanged'}
          otherCommitters={otherCommitters}
          selected={props.selectedAuthors}
        />
      </div>
    </div>
  );
};

const UniversalConfig = connect(mapStateToProps, mapDispatchToProps)(UniversalConfigComponent);

export default UniversalConfig;
