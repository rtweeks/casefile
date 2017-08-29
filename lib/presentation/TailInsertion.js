'use babel';

import React from 'react';
import Actions from '../data/CasefileActions';
import { DropTarget } from '../atom-react-dnd';
import { DraggableItems } from '../pkg-vals';

const TailInsertion = DropTarget(
  [DraggableItems.BOOKMARK],
  (props) => {
    const displayClass = props.showInsertBefore ? "insert-before" : ""
    return (
      <div className="tail-insertion">
        <div className="indent-align">&nbsp;</div>
        <div className={displayClass}>&nbsp;</div>
      </div>
    );
  },
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
