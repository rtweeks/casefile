'use babel';

import React from 'react';
import Actions from '../data/CasefileActions';
import { openBookmark } from '../bookmarks';
import { Draggable } from '../atom-react-dnd';
import { DraggableItems } from '../pkg-vals';

const Bookmark = (props) => {
  const file = atom.project.relativizePath(props.info.file)[1];
  const itemPath = [...props.ancestors, props.info.id];
  const children = props.info.children.map((childMark) =>
    <Bookmark
      key={childMark.id}
      info={childMark}
      ancestors={itemPath}/>
  );
  const openThis = () => {
    const mark = props.info;
    openBookmark(mark.file, mark.line, mark.markText);
  };
  const deleteThis = () => {
    if (window.confirm("Delete bookmark on \"" + props.info.markText + "\"?")) {
      Actions.deleteBookmark(itemPath);
    }
  };
  return (
    <div className="bookmark">
      <div className="bookmark-body">
        <div className="handle">
          <span className="icon icon-grabber"></span>
        </div>
        <div>
          <div className="line-ref">
            <span onClick={openThis}>{file}:{props.info.line}</span>
          </div>
          <div className="tagged-code" onClick={openThis}>{props.info.markText}</div>
        </div>
      </div>
      <div className="child-marks">{children}</div>
    </div>
  );
}

//export default Bookmark;
export default Draggable(
  DraggableItems.BOOKMARK,
  Bookmark,
  {
    beginDrag(props) {
      return {
        itemPath: [...props.ancestors, props.info.id]
      };
    },
    
    dropEffect() {
      return 'move';
    }
  }
)
