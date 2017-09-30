'use babel';

import React from 'react';
import { CompositeDisposable } from 'atom';
import marked from 'marked';
import { createHash } from 'crypto';
import Actions from '../data/CasefileActions';
import { openBookmark } from '../bookmarks';
import { Draggable, DropTarget } from '../atom-react-dnd';
import { DraggableItems } from '../pkg-vals';
import jQuery from 'jquery';
import TailInsertion from './TailInsertion';

function hashStr(s) {
  return createHash('md5').update(s).digest('hex');
}

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
      if (mark.info.file) {
        openBookmark(mark);
      }
    };
    const deleteThis = () => {
      if (window.confirm("Delete bookmark on \"" + props.info.markText + "\"?")) {
        Actions.deleteBookmark(itemPath);
      }
    };
    var MarkInfoDisplay = (infoProps) => {
      var markContent;
      if (!file) {
        markContent = (
          <h3>{props.info.markText}</h3>
        );
      } else {
        markContent = (
          <div>
            <div className="line-ref">
              <span onClick={openThis}>{file}:{props.info.line}</span>
            </div>
            <div className="tagged-code" onClick={openThis}>{props.info.markText}</div>
          </div>
        );
      }
      return (
        <div className={infoProps.showInsertBefore ? "insert-before" : ""}>
          {markContent}
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
      <div className="bookmark" style={{opacity: props.isDragging ? 0.5 : 1}} notesHash={hashStr(props.info.notes || "")}>
        <div className="bookmark-body" ref={(elt) => this.element = elt} data-mark-path={JSON.stringify(itemPath)}>
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
    if (this.props.info.notes) {
      this.createTooltip();
    }
  }
  
  componentWillUpdate(newProps) {
    if (!this.props.info.notes !== !newProps.info.notes) {
      if (newProps.info.notes) {
        this.createTooltip();
      } else {
        this.tooltip && this.tooltip.dispose();
      }
    }
  }
  
  createTooltip() {
    this.tooltip = atom.tooltips.add(this.element, {
      title: () => "<div class=\"casefile-tooltip\">" + marked(this.props.info.notes) + "</div>"
    });
  }
  
  componentWillUnmount() {
    this.tooltip && this.tooltip.dispose();
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
