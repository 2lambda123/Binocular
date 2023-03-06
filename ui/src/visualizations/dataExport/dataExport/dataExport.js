'use strict';

import React from 'react';
import styles from '../styles.scss';
import dataExportStyles from '../styles/dataExport.scss';
import GetData from './helper/getData';
import Promise from 'bluebird';
import viewIcon from '../assets/viewIcon.svg';
import downloadIcon from '../assets/downloadIcon.svg';
import JSZip from 'jszip';
import FileSaver from 'file-saver';

export default class DataExport extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      collections: { branches: [], builds: [], commits: [], files: [], issues: [], languages: [], modules: [], stakeholders: [] },
      relations: {
        commits_commits: [],
        commits_files: [],
        commits_languages: [],
        commits_modules: [],
        commits_stakeholders: [],
        issues_commits: [],
        issues_stakeholders: [],
        languages_files: [],
        modules_files: [],
        modules_modules: [],
      },
      previewTable: [],
      exportType: 'json',
    };
  }

  /**
   * Update computed commit data
   * @param nextProps props that are passed
   */
  componentWillReceiveProps(nextProps) {
    console.log(nextProps);
  }

  render() {
    const previewTableHeader = this.state.previewTable.length > 0 ? Object.keys(this.state.previewTable[1]) : [];
    return (
      <div className={styles.chartContainer}>
        <div className={styles.mg1}>
          <h1>1. Load Data</h1>
          <div className={dataExportStyles.sectionArrowContainer}>
            <div className={dataExportStyles.sectionArrowStem}></div>
            <div className={dataExportStyles.sectionArrowHead}></div>
          </div>
          <div className={dataExportStyles.section}>
            <button className={'button ' + dataExportStyles.button} onClick={this.loadData.bind(this)}>
              Load Data
            </button>
          </div>
          <h1>2. Choose Export Type</h1>
          <div className={dataExportStyles.sectionArrowContainer}>
            <div className={dataExportStyles.sectionArrowStem}></div>
            <div className={dataExportStyles.sectionArrowHead}></div>
          </div>
          <div className={dataExportStyles.section}>
            <button
              className={'button ' + dataExportStyles.button + (this.state.exportType === 'json' ? ' ' + dataExportStyles.selected : '')}
              onClick={() => {
                this.setState({ exportType: 'json' });
              }}>
              JSON
            </button>
            <button
              className={'button ' + dataExportStyles.button + (this.state.exportType === 'csv' ? ' ' + dataExportStyles.selected : '')}
              onClick={() => {
                this.setState({ exportType: 'csv' });
              }}>
              CSV
            </button>
          </div>
          <h1>3. View and Download Data</h1>
          <div className={dataExportStyles.sectionArrowContainer}>
            <div className={dataExportStyles.sectionArrowStem}></div>
            <div className={dataExportStyles.sectionArrowHead}></div>
          </div>
          <div className={dataExportStyles.section}>
            <h2>Collections</h2>
            {Object.keys(this.state.collections).map((c) => {
              return (
                <div>
                  {c}: {this.state.collections[c].length}
                  <img
                    className={dataExportStyles.icon}
                    src={viewIcon}
                    onClick={() => {
                      this.setState({ previewTable: this.state.collections[c] });
                    }}></img>
                  <img
                    className={dataExportStyles.icon}
                    src={downloadIcon}
                    onClick={() => {
                      this.download(c, this.state.collections[c]);
                    }}></img>
                </div>
              );
            })}

            <h2>Relations</h2>
            {Object.keys(this.state.relations).map((r) => {
              return (
                <div>
                  {r.replace('_', '-')}: {this.state.relations[r].length}
                  <img
                    className={dataExportStyles.icon}
                    src={viewIcon}
                    onClick={() => {
                      this.setState({ previewTable: this.state.relations[r] });
                    }}></img>
                  <img
                    className={dataExportStyles.icon}
                    src={downloadIcon}
                    onClick={() => {
                      this.download(r.replace('_', '-'), this.state.relations[r]);
                    }}></img>
                </div>
              );
            })}
          </div>
          <hr />
          <button className={'button ' + dataExportStyles.button} onClick={this.createExportZipAndDownload.bind(this)}>
            Export Complete Database
          </button>
          <hr />
          <div className={dataExportStyles.previewTableContainer}>
            {this.state.previewTable.length !== 0 ? (
              <table className={dataExportStyles.previewTable}>
                <thead className={dataExportStyles.previewTableHeader}>
                  <tr>
                    {previewTableHeader.map((key, i) => {
                      return (
                        <th className={i % 2 === 0 ? dataExportStyles.previewTableHeaderEven : dataExportStyles.previewTableHeaderOdd}>
                          {key}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {this.state.previewTable.map((row, i) => {
                    return (
                      <tr>
                        {previewTableHeader.map((key, j) => {
                          return <th className={dataExportStyles.previewTableCell}>{JSON.stringify(row[key])}</th>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              ''
            )}
          </div>
        </div>
      </div>
    );
  }

  download(filename, jsonObject) {
    let blob = '';
    switch (this.state.exportType) {
      case 'csv':
        blob = new Blob([this.convertToCSV(jsonObject)], { type: 'data:text/csv;charset=utf-8' });
        FileSaver.saveAs(blob, filename + '.csv');
        break;
      default:
        blob = new Blob([JSON.stringify(jsonObject)], { type: 'data:text/json;charset=utf-8' });
        FileSaver.saveAs(blob, filename + '.json');
        break;
    }
  }

  convertToCSV(jsonObject) {
    const items = jsonObject;
    const replacer = (key, value) => (value === null ? '' : value);
    const header = Object.keys(items[0]);
    const csv = [
      header.join(','),
      ...items.map((row) => header.map((fieldName) => JSON.stringify(row[fieldName], replacer)).join(',')),
    ].join('\r\n');
    return csv;
  }

  loadData() {
    Promise.resolve(GetData.getDatabase()).then((resp) => {
      const database = resp;

      const collections = this.state.collections;
      const relations = this.state.relations;

      collections.branches = database.branches;
      collections.builds = database.builds;
      collections.commits = database.commits;
      collections.files = database.files;
      collections.issues = database.issues;
      collections.languages = database.languages;
      collections.modules = database.modules;
      collections.stakeholders = database.stakeholders;

      relations.commits_commits = database.commits_commits;
      relations.commits_files = database.commits_files;
      relations.commits_languages = database.commits_languages;
      relations.commits_stakeholders = database.commits_stakeholders;
      relations.issues_commits = database.issues_commits;
      relations.issues_stakeholders = database.issues_stakeholders;
      relations.languages_files = database.languages_files;
      relations.modules_files = database.modules_files;
      relations.modules_modules = database.modules_modules;

      this.setState({
        collections: collections,
        relations: relations,
      });
    });
  }

  createExportZipAndDownload() {
    const zip = new JSZip();
    switch (this.state.exportType) {
      case 'csv':
        for (const c of Object.keys(this.state.collections)) {
          if (this.state.collections[c].length > 0) {
            zip.file(c.replace('_', '-') + '.csv', this.convertToCSV(this.state.collections[c]));
          }
        }
        for (const r of Object.keys(this.state.relations)) {
          if (this.state.relations[r].length > 0) {
            zip.file(r.replace('_', '-') + '.csv', this.convertToCSV(this.state.relations[r]));
          }
        }
        break;
      default:
        for (const c of Object.keys(this.state.collections)) {
          zip.file(c.replace('_', '-') + '.json', JSON.stringify(this.state.collections[c]));
        }
        for (const r of Object.keys(this.state.relations)) {
          zip.file(r.replace('_', '-') + '.json', JSON.stringify(this.state.relations[r]));
        }
        break;
    }

    zip.generateAsync({ type: 'blob' }).then(function (content) {
      FileSaver.saveAs(content, 'db_export.zip');
    });
  }
}