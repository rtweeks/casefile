'use babel';
/** @jsx etch.dom */

import dict from 'dict';
import etch from 'etch';
import jQuery from 'jquery';
import { PureComponent } from '../etch-utils';
import {
  promiseToGetListOfRemotes,
  promiseToFetchFromRemote,
  promiseToSelectCommitsUnknownToRemote
} from '../casefile-sharing';
import Actions from '../data/CasefileSharingActions';
import BookmarkActions from '../data/CasefileActions';
import BookmarkModel from '../data/CasefileModel';
import KnownCasefiles from './KnownCasefiles';
import ConfirmingEdit from './ConfirmingEdit';
import CasefileRecoverySelect from './CasefileRecoverySelect';

export default class ToolPanel {
  constructor(props) {
    this.props = props;
    this.git_remotes = [];
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
    const {modelLocked} = this.props;
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
                  disabled={modelLocked}
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
                    disabled={modelLocked}
                    onChange={newValue => this.handleShareNameChange(newValue)}
                    />
                </div>
              </div>
              <div className="inline-block">
                <button className="btn icon icon-cloud-upload"
                  disabled={modelLocked || !canPush}
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
              <div className="btn-group">
                <button
                  className="btn btn-primary icon icon-move-left"
                  disabled={modelLocked || !importPossible}
                  on={{click: this.handleImportClick}}>Import</button>
                <button
                  className="btn btn-warning icon icon-trashcan"
                  disabled={modelLocked || !importPossible}
                  on={{click: this.handleDeleteClick}}
                  >Delete</button>
              </div>
            </div>
          </div>
        </div>
        <div className="section">
          <h1 className="section-heading icon icon-history">Deleted Casefile Recovery</h1>
          <div className="casefile-recovery-ui">
            <CasefileRecoverySelect
              onQueryUpdate={showingList => this.handleRecoveryQueryUpdate(showingList)}
              onChange={item => this.handleRecoveryItemSelection(item)}
              />
            <div className="casefile-recovery-buttons">
              <button
                ref="recoverButton"
                className="btn btn-primary icon icon-move-left"
                disabled={!this.selectedRecoveryItem}
                on={{click: this.handleRecoverClick}}
                >Recover</button>
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
    etch.update(this);
    Actions.fetchRemote();
  }
  
  shareCurrentCasefile() {
    const casefile = BookmarkModel.getState(),
      remote = (this.props.state || {}).selectedRemote,
      commits = [];
    
    const pendingBookmarks = casefile.slice();
    while (pendingBookmarks.length > 0) {
      const bm = pendingBookmarks.pop();
      if (bm.peg && commits.indexOf(bm.peg.commit) < 0) {
        commits.push(bm.peg.commit);
      }
      pendingBookmarks.push(...bm.children);
    }
    
    // Tell the (sharing) model we'd like to share the casefile, once we...
    Actions.shareCasefile(
      // Resolve a promise to fetch the remote, then...
      promiseToFetchFromRemote(remote).then(() => 
        new Promise(function(resolve, reject) {
          promiseToSelectCommitsUnknownToRemote(remote, commits).then(unknownCommits => {
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
  
  handleDeleteClick() {
    const paths = this.selectedCasefileGroup.instances.map(i => i.path);
    if (confirm("Really delete these casefiles?")) {
      Actions.deleteCasefiles(paths);
    }
  }
  
  handleShareNameChange(newValue) {
    Actions.setSharePath(newValue);
  }
  
  handleRecoveryQueryUpdate(showingList) {
    if (showingList) {
      this.refs.recoverButton.scrollIntoView();
    }
  }
  
  handleRecoveryItemSelection(item) {
    if (item !== this.selectedRecoveryItem) {
      this.selectedRecoveryItem = item;
      return etch.update(this);
    } else {
      return Promise.resolve(null);
    }
  }
  
  handleRecoverClick() {
    const recoveryItem = this.selectedRecoveryItem;
    if (!recoveryItem) {
      return;
    }
    const fullImport = BookmarkModel.getState().length == 0;
    BookmarkActions.recoverSharedFile(recoveryItem);
    Actions.setSharePath(recoveryItem.path);
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
