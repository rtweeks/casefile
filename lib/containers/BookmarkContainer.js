'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import BookmarkList from '../presentation/BookmarkList';
import Model from '../data/CasefileModel';

function getStores() {
  return [Store];
}

function getState() {
  return {
    bookmarks: Store.getState()
  };
}

//export default Container.createFunctional(BookmarkList, getStores, getState);
export default class BookmarkContainer {
  constructor(props) {
    this.props = Object.assign({bookmarks: Model.getState()}, props);
    
    // Bind to store
    this._modelBinding = Model.bindView(this, "bookmarks", "_modelUpdate");
    
    etch.initialize(this);
    
    this.configWatcher = atom.config.onDidChange('casefile.notesSide', {}, () => {
      etch.update(this);
    });
  }
  
  render() {
    const notesSide = atom.config.get('casefile.notesSide');
    return <BookmarkList
      notesSide={notesSide}
      {...this.props} />;
  }
  
  update(props) {
    this.props = Object.assign({}, this.props, props);
    return etch.update(this);
  }
  
  _modelUpdate(model, {locked: modelLocked}) {
    this.update(Object.assign({}, this.props, model, {modelLocked}));
  }
  
  async destroy() {
    await etch.destroy(this);
    Model.unbindView(this._modelBinding);
    if (this.configWatcher) {
      this.configWatcher.dispose();
    }
  }
}