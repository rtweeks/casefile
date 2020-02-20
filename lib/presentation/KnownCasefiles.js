'use babel';
/** @jsx etch.dom */

import dict from 'dict';
import etch from 'etch';
import jQuery from 'jquery';
import {
  promiseToGetAuthors
} from '../casefile-sharing';

const casefileIconClass = "icon icon-file";

export default class KnownCasefiles {
  constructor(props) {
    this.props = props;
    this.selected = null;
    this.expanded = [];
    this.selectAllMutligroupPaths();
    this.pathsLoadingAuthors = [];
    this.instanceAuthors = dict({});
    etch.initialize(this);
  }
  
  selectAllMutligroupPaths() {
    this.pathsSelected = this.props.casefiles.flatMap(cfg =>
      (cfg.instances.length > 1) ? cfg.instances.map(i => i.path) : []
    );
  }
  
  render() {
    const casefiles = this.props.casefiles;
    if (!casefiles || casefiles.length === 0) {
      return (
        <ul className='background-message'>
          <li>None Known</li>
        </ul>
      );
    }
    
    return (
      <div className="known-casefiles-list" on={{click: this.handleCasefileClick}}>
        <ul className='list-tree has-collapsable-children'>
          {casefiles.map(cfg => this.renderItem(cfg))}
        </ul>
      </div>
    )
  }
  
  renderItem(casefileGroup) {
    const {name, instances} = casefileGroup;
    if (instances.length === 1) {
      const selClass = (this.selected === name) ? ' selected' : '';
      return (
        <li className={'list-item shared-casefile' + selClass} key={name}>
          <span className={casefileIconClass}>{name}</span>
        </li>
      );
    } else {
      return this.renderGroup(casefileGroup);
    }
  }
  
  renderGroup(casefileGroup) {
    const {name, instances} = casefileGroup;
    let children = [], needsLoad = false;
    if (!instances.every(i => this.instanceAuthors.has(i.path))) {
      children = [
        <li className='list-item' key="*loading*">
          <span className='loading loading-spinner-tiny inline-block'>Loading...</span>
        </li>
      ];
      needsLoad = !!instances.find(i => this.pathsLoadingAuthors.indexOf(i.path) < 0);
    } else {
      children = instances.map(instance => {
        const selected = this.pathsSelected.indexOf(instance.path) >= 0;
        const authors = this.instanceAuthors.get(instance.path, ['unknown author(s)']);
        return (
          <li className='list-item group-instance' key={instance.path}>
            <label className="input-label">
              <input
                className="input-checkbox selector"
                attributes={{type: 'checkbox'}}
                checked={selected}
                on={{change: this.handleInstanceSelectChange}}
                />
              <span className={casefileIconClass}>By {authors.join(', ')}</span>
            </label>
          </li>
        );
      });
    }
    
    const stateClass = this.multiInstanceState(name);
    return (
      <li className={'list-nested-item shared-casefile' + stateClass} key={name} needsLoad={needsLoad}>
        <div className="list-item">
          <span
            className="icon icon-file-directory">{name}</span>
        </div>
        <ul className='list-tree has-flat-children'>
          {children}
        </ul>
      </li>
    );
  }
  
  update(props) {
    this.props = props;
    return etch.update(this);
  }
  
  handleCasefileClick(e) {
    // Find the casefile li
    const $t = jQuery(e.target);
    const $li = jQuery(e.target).closest('li');
    if ($li.length === 0 || !$li.hasClass('shared-casefile')) {
      return;
    }
    const groupName = $li.prop('key');
    
    // Mark it as selected (use "key" property)
    const wasSelected = this.selected == groupName;
    this.selected = groupName;
    let selectedCasefileGroup = this.props.casefiles.find(i => i.name === this.selected);
    
    // Deal with multi-instance groups
    if ($li.hasClass('list-nested-item')) {
      // Toggle in `this.expanded`
      let expandedIdx = this.expanded.indexOf(groupName);
      if (expandedIdx < 0) {
        this.expanded.push(groupName);
      } else if (wasSelected) {
        this.expanded.splice(expandedIdx, 1);
      }
      
      // If needed, load authors
      if ($li.prop('needsLoad')) {
        this.loadAuthors(selectedCasefileGroup);
      }
      
      // Build a "casefile group" object that only has the selected instances
      selectedCasefileGroup = {
        name: groupName,
        instances: (
          $li
          .find('.group-instance')
          .has('.selector')
          .get()
          .flatMap(e => this.pathsSelected.indexOf(e.key) ? [{path: e.key}] : [])
        )
      };
      if ($li.prop('needsLoad')) {
        selectedCasefileGroup.instances = this.pathsSelected.flatMap(p => 
          p.startsWith(groupName + '/') ? [{path: p}] : []
        );
      }
    }
    
    if (this.props.onSelect) {
      this.props.onSelect(selectedCasefileGroup);
    }
    
    etch.update(this);
  }
  
  handleInstanceSelectChange(e) {
    const $t = jQuery(e.target);
    const $li = $t.closest('li.shared-casefile');
    if ($li.length === 0) {
      return;
    }
    const groupName = $li.prop('key');
    const path = $t.closest('.group-instance').prop('key');
    
    // Update state in this.pathsSelected
    const selectedIdx = this.pathsSelected.indexOf(path);
    const instanceChecked = $t.is(':checked');
    
    if (selectedIdx >= 0 && !instanceChecked) {
      this.pathsSelected.splice(selectedIdx, 1);
    } else if (selectedIdx < 0 && instanceChecked) {
      this.pathsSelected.push(path);
    }
    
    this.selected = groupName;
    let selectedCasefileGroup = {
      name: groupName,
      instances: (
        $li
        .find('.group-instance')
        .has('.selector')
        .get()
        .flatMap(e => (this.pathsSelected.indexOf(e.key) >= 0) ? [{path: e.key}] : [])
      )
    };
    
    if (this.props.onSelect) {
      this.props.onSelect(selectedCasefileGroup);
    }
    
    etch.update(this);
  }
  
  loadAuthors(casefileGroup) {
    const authorPromises = casefileGroup.instances.map(instance =>
      promiseToGetAuthors(instance.path)
    );
    casefileGroup.instances.forEach(instance => {
      const pathsLoading = this.pathsLoadingAuthors;
      if (pathsLoading.indexOf(instance.path) < 0) {
        pathsLoading.push(instance.path);
      }
    });
    etch.update(this);
    
    let authorsRetrieved = 0;
    let settledAuthorsRequest = (resolve) => {
      ++authorsRetrieved;
      if (authorsRetrieved >= authorPromises.length) {
        resolve();
      }
    };
    new Promise((resolve, reject) => {
      authorPromises.forEach(p => p.then(
        (result) => {
          this.instanceAuthors.set(result.path, result.authors);
          settledAuthorsRequest(resolve);
        },
        () => {settledAuthorsRequest(resolve);}
      ));
    }).then(() => {
      etch.update(this);
    });
  }
  
  multiInstanceState(groupName) {
    var result = '';
    if (this.selected === groupName) {
      result = result + ' selected';
    }
    if (this.expanded.indexOf(groupName) < 0) {
      result = result + ' collapsed';
    }
    return result;
  }
}
