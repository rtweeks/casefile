'use babel';

import React from 'react';
import Bookmark from './Bookmark';
import Actions from '../data/CasefileActions';
import { DropTarget } from '../atom-react-dnd';
import { DraggableItems } from '../pkg-vals';

class TrashArea extends React.Component {
  renderOverlay(color) {
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '100%',
        zIndex: 1,
        opacity: 0.5,
        backgroundColor: color
      }} />
    )
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

export default (props) => {
  const marks = props.bookmarks.map((mark) =>
    <Bookmark key={mark.id} info={mark} ancestors={[]}/>
  );
  return (
    <div>
      <div>
        {marks}
      </div>
      <Trash />
    </div>
  );
}
