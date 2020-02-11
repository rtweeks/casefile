'use babel';
/** @jsx etch.dom */

import dict from 'dict';
import etch from 'etch';
import jQuery from 'jquery';
import { PureComponent } from '../etch-utils';
import {
  promiseToGetListOfRemotes,
} from '../casefile-sharing';
import Actions from '../data/CasefileSharingActions';
import KnownCasefiles from './KnownCasefiles';

export default class ToolPanel {
  constructor(props) {
    this.props = props;
    this.git_remotes = [];
    this.allowFetch = true;
    this.instanceAuthors = dict({});
    this.expandedCasefileGroups = [];
    this.selectedCasefileGroup = null;
    etch.initialize(this);
    
    promiseToGetListOfRemotes().then((remotes) => {
      this.git_remotes = remotes;
      this.update(this.props);
    });
  }
  
  render() {
    return (
      <atom-panel>
        <div className="section">
          <h1 className="section-heading icon icon-radio-tower">Remote Collaboration</h1>
          <div className="section-body">
            <div className="inline-control-group">
              <Select id="casefile.sharing.git-remote"
                className="inline-block casefile-sharing-git-remote"
                title="Git Remote"
                options={this.git_remotes}
                selected={this.props.state.selectedRemote}
                on={{change: this.remoteChanged}}
                />
              <div className="inline-block">
                <button className="btn icon icon-cloud-download"
                  disabled={!this.allowFetch}
                  on={{click: this.fetchRemote}}>Fetch Shared</button>
              </div>
            </div>
          </div>
        </div>
        <div className="section">
          <h1 className="section-heading icon icon-repo">Known Casefiles</h1>
          <div className="known-casefiles-ui">
            <KnownCasefiles
              casefiles={(this.props.state || {}).knownCasefiles}
              onSelect={casefile => this.handleCasefileSelection(casefile)}
              />
            <div className="known-casefiles-buttons" comment="TODO: Import button">
              <button className="btn btn-primary icon icon-move-left" disabled={!this.selectedCasefileGroup}>Import</button>
            </div>
          </div>
        </div>
      </atom-panel>
    );
  }
  
  update(props, children) {
    this.props = props;
    return etch.update(this);
  }
  
  remoteChanged(e) {
    Actions.setRemote(jQuery(e.target).val());
  }
  
  fetchRemote() {
    this.allowFetch = false;
    etch.update(this);
    Actions.fetchRemote({
      onDone: () => {
        this.allowFetch = true;
        etch.update(this);
      }
    });
  }
  
  handleCasefileSelection(casefile) {
    this.selectedCasefileGroup = casefile;
    etch.update(this);
  }
}

Select = PureComponent((props) => {
  const title = (props.id && props.title) ? [<label for={props.id}>{props.title}</label>] : [];
  const options = props.options.map((item) => {
    const itemId = props.getId ? props.getId(item) : (item[props.idProperty || "id"] || item.toString());
    return (
      <option value={itemId} selected={props.selected === itemId}>{item.toString()}</option>
    );
  });
  return (
    <div className={props.className}>
      {title}
      <select id={props.id} className="form-control" on={{change: (props.on || {}).change}}>{options}</select>
    </div>
  );
});
