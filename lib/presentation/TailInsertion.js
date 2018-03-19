'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import Actions from '../data/CasefileActions';
import { DropTarget } from '../atom-etch-dnd';
import { PureComponent } from '../etch-utils';
import { DraggableItems } from '../pkg-vals';

const TailInsertion = DropTarget(
  [DraggableItems.BOOKMARK],
  PureComponent((props) => {
    const displayClass = props.showInsertBefore ? "insert-before" : ""
    return (
      <div className="tail-insertion">
        <div className="indent-align">&nbsp;</div>
        <div className={displayClass}>&nbsp;</div>
      </div>
    );
  }),
  {
    canDrop(props) {
      return !props.parentPath.includes(props.id);
    },
    drop(props) {
      Actions.moveBookmark(props.itemPath, props.parentPath, null);
    }
  },
  (monitor) => {
    return {
      showInsertBefore: monitor.canDrop() && monitor.isOver()
    }
  }
)

export default TailInsertion;
