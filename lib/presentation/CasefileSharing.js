'use babel';
/** @jsx etch.dom */

import dict from 'dict';
import etch from 'etch';
import jQuery from 'jquery';
import { PureComponent } from '../etch-utils';
import {
  promiseToGetListOfRemotes
} from '../casefile-sharing';
import Actions from '../data/CasefileSharingActions';
import BookmarkActions from '../data/CasefileActions';
import BookmarkModel from '../data/CasefileModel';
import KnownCasefiles from './KnownCasefiles';
import ConfirmingEdit from './ConfirmingEdit';

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
    const importPossible = ((this.selectedCasefileGroup || {}).instances || []).length > 0
    const sharePath = this.currentSharePathInfo();
    const canPush = sharePath.groupName != '';
    return (
      <atom-panel>
        <div className="section">
          <h1 className="section-heading icon icon-radio-tower">Remote Collaboration</h1>
          <div className="section-body">
            <div className="inline-control-group">
              <Select id="casefile-sharing-git-remote"
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
              <div className="inline-block">
                <label for="casefile-sharing-name">Share As</label>
                <div>
                  <ConfirmingEdit
                    id="casefile-sharing-name"
                    className="casefile-sharing-name"
                    value={sharePath.groupName}
                    displayValue={sharePath.display}
                    suggestions={((this.props.state || {}).knownCasefiles || []).map(cfg => cfg.name)}
                    onChange={newValue => this.handleShareNameChange(newValue)}
                    />
                </div>
              </div>
              <div className="inline-block">
                <button className="btn icon icon-cloud-upload"
                  disabled={!canPush}
                  on={{click: this.shareCurrentCasefile}}>Share Your Casefile</button>
              </div>
            </div>
          </div>
        </div>
        <div className="section">
          <h1 className="section-heading icon icon-repo">Known Casefiles</h1>
          <div className="known-casefiles-ui">
            <KnownCasefiles
              casefiles={(this.props.state || {}).knownCasefiles || []}
              onSelect={casefile => this.handleCasefileSelection(casefile)}
              />
            <div className="known-casefiles-buttons">
              <button
                className="btn btn-primary icon icon-move-left"
                disabled={!importPossible}
                on={{click: this.handleImportClick}}>Import</button>
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
  
  shareCurrentCasefile() {
    const casefile = BookmarkModel.getState(),
      remote = (this.props.state || {}).selectedRemote;
    
    // Tell the (sharing) model we'd like to share the casefile, once we...
    Actions.shareCasefile(
      // Resolve a promise to fetch the remote, then...
      promiseToFetchFromRemote(remote).then(() => 
        new Promise(function(resolve, reject) {
          promiseToSelectCommitsUnknownToRemote(remote).then(unknownCommits => {
            if (!unknownCommits || unknownCommits.length === 0) {
              resolve();
              return;
            }
            
            const userCancelled = () => {
              reject(`Casefile involves commits unknown by '${remote}'; user cancelled`);
            };
            
            var description = `'${remote}' doesn't know any of these commits:\n`;
            unknownCommits.forEach(commit => {
              description = description + `* ${commit.slice(0, 17)}\n`
            });
            
            atom.notifications.addWarning(
              `Some commits in the casefile are unknown to remote '${remote}'`,
              {
                description,
                buttons: [
                  {
                    className: 'btn',
                    text: 'Cancel Push',
                    onDidClick: userCancelled
                  },
                  // TODO: Add an option for a sharing push
                  {
                    text: 'Push Anyway',
                    onDidClick: () => {resolve();}
                  }
                ]
              }
            ).onDidDismiss(userCancelled);
          });
        })
      ).then(() => casefile)
    );
  }
  
  handleCasefileSelection(casefile) {
    this.selectedCasefileGroup = casefile;
    etch.update(this);
  }
  
  handleImportClick() {
    const group = this.selectedCasefileGroup;
    const fullImport = group.instances.length == 1 && BookmarkModel.getState().length == 0;
    BookmarkActions.importSharedFile(group.name, group.instances.map(i => i.path));
    if (fullImport) {
      Actions.setSharePath(group.instances[0].path);
      atom.notifications.addInfo(
        "Targeting the selected instance of '" + group.name + "' for casefile sharing",
        {
          description: "If you share the current casefile, it will update the casefile you have just imported.",
          dismissable: true
        }
      );
    } else {
      Actions.setSharePath(group.name);
      atom.notifications.addInfo(
        "Targeting new, separate instance of '" + group.name + "' for casefile sharing",
        {
          description: "If you share the current casefile, it will be shared as a new instance under the '" + group.name + "' casefile group you have just imported." +
          "\n\nTo work directly on updates to an existing, shared casefile, first clear the casefile, then import a single instance.",
          dismissable: true
        }
      );
    }
  }
  
  handleShareNameChange(newValue) {
    Actions.setSharePath(newValue);
  }
  
  currentSharePathInfo() {
    const sharePath = (this.props.state || {}).sharePath || '';
    const group = sharePath.split('/')[0];
    if (group === '') {
      return {groupName: '', display: '(none)'};
    }
    const casefiles = (this.props.state || {}).knownCasefiles || [];
    const currentIsNewInstance = casefiles.find(cfg => (
      cfg.name === group &&
      !cfg.instances.find(inst => inst.path === sharePath)
    ));
    const newInstanceMark = [];
    if (currentIsNewInstance) {
      newInstanceMark.push(<span class="text-subtle">(new instance)</span>);
    }
    return {
      groupName: group,
      //display: group + (currentIsKnown ? '' : ' (new instance)')
      display: <span>{group} {newInstanceMark}</span>
    };
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
