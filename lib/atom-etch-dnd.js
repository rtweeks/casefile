'use babel';
/** @jsx etch.dom */

import etch from 'etch';
import jQuery from 'jquery';

const dataType = "x-drag-and-drop/json";
const cleanupHandlerPrefix = "h:";
const dropTargetClass = "b9eef5d170d9de0b5be7c7b221ae3c221cb17e35";

var stateUpdateTimes = [];
const dragEventNode = jQuery('<div>'), dragState = {
  register(callback) {
    dragEventNode.on('dragstateupdate', callback);
  },
  
  update(mutator) {
    const stateUpdate = mutator(dragState);
    if ((function() {
      for (k of Object.keys(stateUpdate)) {
        if (k !== 'pointer' && dragState[k] !== stateUpdate[k]) {
          return true;
        }
      }
      if ('pointer' in stateUpdate) {
        return (stateUpdateTimes.length === 0) || (stateUpdateTimes.slice(-1)[0] + 200 <= Date.now());
      }
      return false;
    })()) {
      const now = Date.now();
      stateUpdateTimes.push(now);
      if (stateUpdateTimes.length > 50) {
        const intervalStart = stateUpdateTimes.shift();
        if (intervalStart + 5000 > now) {
          console.log("atom-etch-dnd: Excessive state updating");
        }
      }
      Object.assign(dragState, stateUpdate);
      dragEventNode.trigger('dragstateupdate');
    }
  },
  
  cleanupHandlers: {},
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

export function whenDragEnds(cleanupId, handler) {
  dragState.cleanupHandlers[cleanupHandlerPrefix + cleanupId] = handler;
}

function getDataTransfer(e) {
  let dataTransfer = (e.originalEvent || e).dataTransfer;
  return Object.assign(dataTransfer, {clientX: e.clientX, clientY: e.clientY});
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
      jQuery(elt).attr('drag-id', dragElementId++);
      const $handle = this.getDragHandleJQ();
      this.attachDragHandling($handle);
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
      return etch.update(this).then((v) => {this.updateDragHandlers(); return v;});
    }
    
    updateDragHandlers() {
      const elt = this.element;
      const $handle = this.getDragHandleJQ()
      if (!$handle.attr('draggable')) {
        this.attachDragHandling($handle);
      }
    }
    
    attachDragHandling($handle) {
      const elt = this.element;
      (
        $handle
        .attr('draggable', true)
        .on('dragstart', (e) => this.startDrag(e, elt))
        .on('dragend', (e) => this.endDrag(e))
      );
    }
    
    getDragHandleJQ() {
      const elt = this.element;
      if (elt === null) {
        return jQuery();
      }
      const $elt = jQuery(elt);
      if ('dragHandle' in spec) {
        const $nested = $elt.find('* .draggable-container');
        return $elt.find('*').not($nested.find('*')).filter(spec.dragHandle);
      } else {
        return $elt;
      }
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
      var {cleanupHandlers} = dragState;
      dragState.update(() => {return {
        cleanupHandlers: {},
        dragged: null,
        dragData: null,
        itemType: null,
        currentTarget: null,
        pointer: null
      };});
      this.ghost.remove();
      for (var [name, handler] of Object.entries(cleanupHandlers)) {
        if (name.startsWith(cleanupHandlerPrefix)) {
          handler();
        }
      }
    }
  };
}

export function DropTarget(itemTypes, WrappedComponent, spec, collect) {
  if (!Array.isArray(itemTypes)) {
    itemTypes = [itemTypes];
  }
  
  function dropTargetMonitor(component) {
    return {
      getTargetElement() {
        let t = dragState.currentTarget;
        return t && t.element;
      },
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
      isOver() {return dragState.currentTarget === component;},
      pointerCoords() /* returns {x,y} Object or falsish */ {
        return dragState.pointer;
      },
      targetBounds() /* returns DOMRect */ {
        let t = dragState.currentTarget;
        return t && t.element ? t.element.getBoundingClientRect() : {};
      }
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
        .on('dragover', (e) => this.updateDropFeedback(e))
        .on('drop', (e) => this.drop(e))
        .on('dragleave', (e) => this.dragLeave(e))
      );
    }
    
    render() {
      const wrappedProps = Object.assign({}, this.props, collect(dropTargetMonitor(this)));
      const wrapped = <WrappedComponent {...wrappedProps} />;
      return (
        <span className={dropTargetClass}>{wrapped}</span>
      );
    }
    
    update(props) {
      this.props = props;
      return etch.update(this);
    }
    
    dragEnter(e) {
      if (this.dropAllowed(getDataTransfer(e))) {
        if (jQuery(e.target).hasClass(dropTargetClass)) {
          dragState.update((oldState) => {
            return {currentTarget: this};
          });
        }
        e.preventDefault();
      }
    }
    
    updateDropFeedback(e) {
      const dragData = getDataTransfer(e);
      if (this.dropAllowed(dragData)) {
        e.preventDefault();
        let pointer = {x: e.clientX, y: e.clientY};
        dragState.update((oldState) => ({currentTarget: this, pointer}));
      } else {
        dragState.update(() => ({currentTarget: null}));
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
        spec.drop(
          Object.assign({}, this.props, dragData),
          {point: {x: e.clientX, y: e.clientY}, targetElement: e.currentTarget}
        );
      } else {
        spec.dropRaw(dataTransfer);
      }
    }
    
    dragLeave(e) {
      if (!jQuery(e.target).hasClass(dropTargetClass)) {
        return;
      }
      if (dragState.currentTarget === this) {
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