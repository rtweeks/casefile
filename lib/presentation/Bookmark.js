'use babel';

import React from 'react';
import { CompositeDisposable } from 'atom';
import marked from 'marked';
import Actions from '../data/CasefileActions';
import { openBookmark } from '../bookmarks';
import { Draggable, DropTarget } from '../atom-react-dnd';
import { DraggableItems } from '../pkg-vals';
import jQuery from 'jquery';
import TailInsertion from './TailInsertion';

class BookmarkBase extends React.Component {
  constructor(props) {
    super(props);
    this.disposables = new CompositeDisposable();
  }
  
  render() {
    const props = this.props;
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
    var MarkInfoDisplay = (infoProps) => {
      return (
        <div className={infoProps.showInsertBefore ? "insert-before" : ""}>
          <div className="line-ref">
            <span onClick={openThis}>{file}:{props.info.line}</span>
          </div>
          <div className="tagged-code" onClick={openThis}>{props.info.markText}</div>
        </div>
      );
    };
    MarkInfoDisplay = DropTarget(
      [DraggableItems.BOOKMARK],
      MarkInfoDisplay,
      {
        canDrop(dragProps) {
          return !itemPath.includes(dragProps.id);
        },
        drop(dragProps) {
          Actions.moveBookmark(dragProps.itemPath, props.ancestors, props.info.id);
        }
      },
      (monitor) => {
        return {
          showInsertBefore: monitor.canDrop() && monitor.isOver()
        };
      }
    );
    return (
      <div className="bookmark" style={{opacity: props.isDragging ? 0.5 : 1}}>
        <div className="bookmark-body" ref={(elt) => this.element = elt}>
          <div className="drag-handle">
            <span className="icon icon-grabber"></span>
          </div>
          <MarkInfoDisplay />
        </div>
        <div className="child-marks">
          {children}
          <TailInsertion parentPath={itemPath} />
        </div>
      </div>
    );
  }
  
  componentDidMount() {
    if (this.props.info['notes']) {
      this.disposables.add(atom.tooltips.add(this.element, {
        title: marked(this.props.info['notes'])
      }));
    }
  }
  
  componentWillUnmount() {
    this.disposables.dispose();
  }
}

//export default Bookmark;
Bookmark = Draggable(
  DraggableItems.BOOKMARK,
  BookmarkBase,
  {
    dragHandle: '.drag-handle',
    beginDrag(props) {
      return {
        id: props.info.id,
        itemPath: [...props.ancestors, props.info.id]
      };
    },
    
    dropEffect() {
      return 'move';
    },
    
    dragImage(elt) {
      const $ = jQuery;
      const $elt = $(elt), $handle = $elt.find('.drag-handle');
      const eltPos = $elt.offset(), handlePos = $handle.offset();
      return {dragPoint: [handlePos.left - eltPos.left + $handle.width() / 2, handlePos.top - eltPos.top + $handle.height() / 2]};
    }
  },
  function(monitor) {
    return {
      isDragging: monitor.isDragging()
    }
  }
)

export default Bookmark;
