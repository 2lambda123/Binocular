'use strict';

import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import cx from 'classnames';
import fuzzy from 'fuzzy';

import styles from './styles.scss';

export default class SearchBox extends React.Component {
  constructor(props) {
    super(props);

    this.selectedDiv = null;
    this.state = {
      searchText: '',
      options: [],
      suggestions: [],
      selectedIndex: null,
      isOpen: false
    };

    _.merge(this.state, this.buildSuggestions(this.state.searchText, this.state.options));
  }

  componentWillReceiveProps(nextProps) {
    let searchText = nextProps.searchText;
    if (nextProps.value) {
      searchText = this.props.renderOption(nextProps.value);
    }
    const suggestions = this.buildSuggestions(searchText, nextProps.options);
    this.setState(suggestions);
  }

  buildSuggestions(searchText = '', options = []) {
    const suggestions = fuzzy.filter(searchText, options || [], {
      extract: this.props.renderOption.bind(this)
    });

    let { selectedIndex } = this.state;

    if (selectedIndex !== null) {
      selectedIndex = Math.min(selectedIndex, suggestions.length - 1);
    }

    console.log('built new suggestions:', suggestions);

    return { searchText, suggestions, selectedIndex };
  }

  render() {
    console.log('rendering with', this.state.searchText, 'and', this.props.value);
    this.selectedDiv = null;
    const suggestions = this.state.suggestions.map((r, i) => (
      <div
        ref={div => {
          if (i === this.state.selectedIndex) {
            this.selectedDiv = div;
          }
        }}
        className={cx(styles.suggestion, { [styles.isSelected]: i === this.state.selectedIndex })}
        key={i}
        onClick={() => this.select(r.original)}>
        {this.props.renderOption(r.original)}
      </div>
    ));

    return (
      <div
        className={cx('control has-icons-right', {
          [styles.isOpen]: this.state.isOpen,
          [styles.hasValue]: !!this.state.value
        })}>
        <input
          className={cx('input')}
          type="text"
          placeholder={this.props.placeholder}
          value={this.state.searchText}
          onFocus={() => this.setState({ isOpen: true })}
          onBlur={() => this.cancel()}
          onChange={e => this.search(e.target.value)}
          onKeyDown={e => this.onKeyDown(e)}
        />
        <span className={cx('icon', 'is-small is-right', styles.icon)} onClick={() => this.clear()}>
          <i
            className={cx('fa', {
              'fa-close': !!this.state.value,
              'fa-search': !this.state.value
            })}
          />
        </span>
        {this.state.isOpen &&
          <div className={cx(styles.suggestions)}>
            {suggestions}
          </div>}
      </div>
    );
  }

  onKeyDown(e) {
    let { selectedIndex } = this.state;
    if (e.key === 'Enter') {
      this.select(this.state.suggestions[selectedIndex].original);
      return false;
    } else if (e.key === 'Escape') {
      this.clear();
      return false;
    }

    if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) {
      selectedIndex = Math.min(this.state.suggestions.length - 1, selectedIndex + 1);
    } else if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) {
      selectedIndex = Math.max(0, selectedIndex - 1);
    }

    if (this.selectedDiv) {
      this.selectedDiv.scrollIntoView({ block: 'end', behaviour: 'smooth' });
    }

    this.setState({ selectedIndex });

    return false;
  }

  select(option) {
    clearTimeout(this.cancelTimer);
    this.setState(
      { searchText: this.props.renderOption(option), isOpen: false, value: option },
      () => {
        if (this.props.onChange) {
          this.props.onChange(option);
        }
      }
    );
  }

  cancel() {
    this.cancelTimer = setTimeout(() => {
      this.setState({ isOpen: false });
    }, 300);
  }

  clear() {
    this.setState({ searchText: '', value: null }, () => {
      if (this.props.onChange) {
        this.props.onChange(null);
      }
    });
  }

  search(searchText) {
    const suggestions = this.buildSuggestions(searchText, this.props.options);
    this.setState(suggestions);
  }
}
