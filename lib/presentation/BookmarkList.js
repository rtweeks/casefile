'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import { PureComponent } from '../etch-utils';
import Bookmark from './Bookmark';
import TailInsertion from './TailInsertion';
import Actions from '../data/CasefileActions';
import { DropTarget } from '../atom-etch-dnd';
import { DraggableItems } from '../pkg-vals';

class TrashArea {
  constructor(props) {
    this.props = props;
    etch.initialize(this);
  }
  
  render() {
    const {isOver, canDrop} = this.props;
    return (
      <div 
        className={"trash"}
        style={{
          backgroundColor: isOver && canDrop ? 'red' : 'inherit',
          opacity: canDrop ? 1 : 0.3
        }}>
        <div>
          <span className="icon icon-trashcan"></span> Remove
        </div>
      </div>
    )
  }
  
  update(props) {
    this.props = props;
    return etch.update(this);
  }
};

const Trash = DropTarget(
  DraggableItems.BOOKMARK,
  TrashArea,
  {
    drop(props) {
      Actions.deleteBookmark(props.itemPath);
    }
  },
  function(monitor) {
    return {
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver()
    }
  }
)

export default PureComponent((props) => {
  const marks = props.bookmarks.map((mark) =>
    <Bookmark key={mark.id} info={mark} ancestors={[]}/>
  );
  return (
    <div className="bookmarks-ui">
      <div style="position: fixed;" className="insertion-marker casefile-hidden"></div>
      <div className="bookmarks">
        {marks}
        </div>
      <Trash />
    </div>
  );
});
