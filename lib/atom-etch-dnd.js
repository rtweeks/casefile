'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import jQuery from 'jquery';

const dataType = "x-drag-and-drop/json";

var stateUpdateTimes = [];
const dragEventNode = jQuery('<div>'), dragState = {
  register(callback) {
    dragEventNode.on('dragstateupdate', callback);
  },
  
  update(mutator) {
    const stateUpdate = mutator(dragState);
    if ((function() {
      for (k in stateUpdate) {
        if (dragState[k] !== stateUpdate[k]) {
          return true;
        }
      }
      return false;
    })()) {
      const now = Date.now();
      stateUpdateTimes.push(now);
      if (stateUpdateTimes.length > 10) {
        const intervalStart = stateUpdateTimes.shift();
        if (intervalStart + 5000 > now) {
          console.log("atom-etch-dnd: Excessive state updating");
        }
      }
      Object.assign(dragState, stateUpdate);
      dragEventNode.trigger('dragstateupdate');
    }
  },
  
  dragged: null,
  currentTarget: null
};

function dragMonitor(component) {
  return {
    isDragging() {
      return (dragState.dragged === component);
    }
  }
}

function getDataTransfer(e) {
  return (e.originalEvent || e).dataTransfer;
}

var dragElementId = 0;

export function Draggable(itemType, WrappedComponent, spec, collect) {
  return class {
    constructor(props) {
      this.props = props;
      this.collectedState = {};
      dragState.register(() => {
        const collectedState = collect(dragMonitor(this));
        for (k in collectedState) {
          if (this.collectedState[k] != collectedState[k]) {
            etch.update(this);
            break;
          }
        }
        return true;
      });
      this.ghost = null;
      
      etch.initialize(this);
      
      const elt = this.element;
      if (elt === null) {
        return;
      }
      var $handle = jQuery(elt).attr('drag-id', dragElementId++);
      if ('dragHandle' in spec) {
        const $nested = $handle.find('* .draggable-container');
        $handle = $handle.find('*').not($nested.find("*")).filter(spec.dragHandle);
      }
      (
        $handle
        .attr('draggable', true)
        .on('dragstart', (e) => this.startDrag(e, elt))
        .on('dragend', (e) => this.endDrag(e))
      );
    }
    
    render() {
      this.collectedState = collect(dragMonitor(this));
      const wrappedProps = Object.assign({}, this.props, this.collectedState);
      const wrapped = <WrappedComponent {...wrappedProps} />;
      return (
        <span
          className="draggable-container"
          >{wrapped}</span>
      );
    }
    
    update(props) {
      this.props = props;
      return etch.update(this);
    }
    
    async destroy() {
      await etch.destroy(this);
    }
    
    startDrag(e, draggable) {
      const dragData = Object.assign(spec.beginDrag(this.props), {type: itemType});
      const dt = getDataTransfer(e);
      dt.setData(dataType, JSON.stringify(dragData));
      if ('dropEffect' in spec) {
        const effectProps = Object.assign({}, this.props);
        for (k of ["ctrlKey altKey shiftKey metaKey"]) {
          effectProps[k] = !!e[k];
        }
        let desiredEffect = spec.dropEffect(effectProps);
        if (typeof desiredEffect === 'string') {
          dt.effectAllowed = desiredEffect;
          dt.dropEffect = desiredEffect;
        } else {
          let [effect, allowed] = desiredEffect;
          dt.effectAllowed = allowed;
          if (effect !== null) dt.dropEffect = effect;
        }
      }
      var img = draggable, dragPoint = [0, 0];
      if ('dragImage' in spec) {
        const specDragImage = spec.dragImage(draggable);
        img = specDragImage.image || img;
        dragPoint = specDragImage.dragPoint || dragPoint;
      }
      if (img instanceof HTMLElement) {
        img = (this.ghost = jQuery(img).clone().css({position: 'fixed', left: -5000}).appendTo(jQuery(img).parent()))[0];
      }
      dt.setDragImage(img, ...dragPoint);
      dragState.update(() => {return {
        dragged: this,
        dragData,
        itemType
      };});
    }
    
    endDrag(e) {
      dragState.update(() => {return {
        dragged: null,
        dragData: null,
        itemType: null,
        currentTarget: null
      };});
      this.ghost.remove();
    }
  };
}

export function DropTarget(itemTypes, WrappedComponent, spec, collect) {
  if (!Array.isArray(itemTypes)) {
    itemTypes = [itemTypes];
  }
  
  function dropTargetMonitor(component) {
    return {
      canDrop() {
        if (!itemTypes.includes(dragState.itemType)) {
          return false;
        }
        if ('canDrop' in spec && !spec.canDrop(
          Object.assign({}, component.props, dragState.dragData)
        )) {
          return false;
        }
        return true;
      },
      isOver() {return dragState.currentTarget === component;}
    }
  }
  
  return class {
    constructor(props) {
      this.props = props;
      dragState.register(() => etch.update(this) || true);
      
      etch.initialize(this);
      
      (
        jQuery(this.element)
        .attr('drag-id', dragElementId++)
        .on('dragenter', (e) => this.dragEnter(e))
        .on('dragover', (e) => this.checkDrop(e))
        .on('drop', (e) => this.drop(e))
        .on('dragleave', (e) => this.dragLeave(e))
      );
    }
    
    render() {
      const wrappedProps = Object.assign({}, this.props, collect(dropTargetMonitor(this)));
      const wrapped = <WrappedComponent {...wrappedProps} />;
      return (
        <span>{wrapped}</span>
      );
    }
    
    update(props) {
      this.props = props;
      return etch.update(this);
    }
    
    dragEnter(e) {
      if (this.dropAllowed(getDataTransfer(e))) {
        dragState.update((oldState) => {
          return {currentTarget: this};
        });
        e.preventDefault();
        
        // Turn off pointer-events (which cause weird dragleave events) for grandchildren
        const $gchildren = jQuery(e.currentTarget).children().children();
        const gchildPEs = $gchildren.map((i, elt) => {
          const $e = jQuery(elt);
          return [$e, $e.css("pointer-events")];
        }).toArray();
        this.endPointerEventBlock = () => {
          for (entry of gchildPEs) {
            gchildPEs[0].css("pointer-events", gchildPEs[1]);
          }
        };
        $gchildren.css("pointer-events", "none");
      }
    }
    
    checkDrop(e) {
      const dragData = getDataTransfer(e);
      if (this.dropAllowed(dragData)) {
        e.preventDefault();
      }
    }
    
    drop(e) {
      const dataTransfer = getDataTransfer(e);
      const dragData = this.getDragData(dataTransfer);
      if (!this.dropAllowed(dataTransfer)) {
        return;
      }
      e.preventDefault();
      if (dragData.type) {
        spec.drop(Object.assign({}, this.props, dragData));
      } else {
        spec.dropRaw(dataTransfer);
      }
    }
    
    dragLeave(e) {
      if (dragState.currentTarget === this) {
        this.endPointerEventBlock();
        dragState.update((oldState) => {
          return {currentTarget: null};
        });
      }
    }
    
    getDragData(dataTransfer) {
      const dragDataJson = dataTransfer.getData(dataType);
      if (!dragDataJson) {
        if (dataTransfer.types.indexOf(dataType) >= 0 && dragState.dragData) {
          return JSON.parse(JSON.stringify(dragState.dragData));
        } else {
          return {};
        }
      }
      try {
        return JSON.parse(dragDataJson);
      } catch (e) {
        return {};
      }
    }
    
    dropAllowed(dataTransfer) {
      const dragData = this.getDragData(dataTransfer);
      if (itemTypes.includes(dragData.type)) {
        return !('canDrop' in spec) || spec.canDrop(
          Object.assign({}, this.props, dragData)
        );
      }
      for (t of dataTransfer.types) {
        if (itemTypes.includes(t)) {
          return true;
        }
      }
      return false;
    }
  }
}