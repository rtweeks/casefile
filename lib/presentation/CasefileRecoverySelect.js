'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import SelectListView from 'atom-select-list';
import {
  promiseToGetDeletedCasefileRefs
} from '../casefile-sharing';

export default class CasefileRecoverySelect {
  constructor(props) {
    this.props = props;
    this.currentQuery = '';
    this.itemList = null;
    this.errorMessage = null;
    etch.initialize(this);
  }
  
  render() {
    const items = this.itemList || [];
    items.sort(itemOrdering);
    const selectedIndex = Math.max(0, items.indexOf(this.selectedItem));
    
    return (
      <SelectListView
        ref="list"
        errorMessage={this.errorMessage}
        query={this.currentQuery}
        items={items}
        order={itemOrdering}
        initialSelectionIndex={selectedIndex}
        filterKeyForItem={function(i) {return i.path.split('/', 1)[0];}}
        maxResults={8}
        elementForItem={generateItemElement}
        didChangeQuery={newQuery => this.handleQueryChange(newQuery)}
        didChangeSelection={item => this.handleSelectionChange(item)}
        />
    );
  }
  
  update(props) {
    this.props = props;
    // We can skip the etch.update(this) because we don't change appearance
    // based on props (just event handling)
    // return etch.update(this);
    return Promise.resolve(this);
  }
  
  handleQueryChange(newQuery) {
    if (this.currentQuery === newQuery) {
      return Promise.resolve(null);
    }
    const view = this.refs.list;
    if (newQuery.includes('/') || newQuery.includes('*') || newQuery.includes('?')) {
      this.errorMessage = "Search pattern may not include '/', '*', or '?'";
    } else {
      this.errorMessage = null;
      this.currentQuery = newQuery;
      if (newQuery.length >= 3) {
        // If we haven't queried git for matching lines...
        if (!this.itemList) {
          promiseToGetDeletedCasefileRefs(newQuery).then(items => {
            this.itemList = items;
            etch.update(this);
          });
        }
      } else {
        // Clear the list of items
        this.itemList = null;
      }
    }
    return etch.update(this);
  }
  
  handleSelectionChange(item) {
    if (this.selectedItem === item) {
      return;
    }
    this.selectedItem = item;
    if (this.props.onChange) {
      this.props.onChange(item);
    }
  }
}

function generateItemElement({commit, committed, path}) {
  const li = document.createElement('li'), name = path.split('/', 1)[0];
  li.textContent = `${name} (deleted ${committed})`;
  return li;
}

function itemOrdering(a, b) {
  if (a.name < b.name) return -1;
  if (b.name < a.name) return 1;
  if (b.committed < a.committed) return -1;
  if (a.committed < b.committed) return 1;
  return 0;
}
