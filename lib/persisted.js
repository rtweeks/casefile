'use babel';

export const beginMarker = '=============================== BEGIN CASEFILE ===============================';
export const endMarker   = '================================ END CASEFILE ================================';
const markers = {beginMarker, endMarker};
const markerPattern = /^\s*=+\s+(BEGIN|END) +CASEFILE\s+=+\s*$/;

for (let markerName in markers) {
  let marker = markers[markerName];
  if (!marker.match(markerPattern)) {
    throw new Error(markerName + " does not match markerPattern");
  }
}

var LineType = {
  beginMarker: 1,
  endMarker: 2,
  other: 0
};

var State = {
  start: 0,
  data: 1,
  error: -1
};

var StateTransitions = [];
/*                               LineType.other   LineType.beginMarker   LineType.endMarker */
StateTransitions[State.start] = [State.start,     State.data,            State.error];
StateTransitions[State.data]  = [State.data,      State.error,           State.start];

var Actions = []
/*                      LineType.other   LineType.beginMarker   LineType.endMarker */
Actions[State.start] = [{},              {},                    null]
Actions[State.data]  = [{collect: 1},    null,                  {deserialize: 1}]

function lineType(line) {
  let mm = line.match(markerPattern);
  if (mm) {
    return LineType[mm[1].toLowerCase() + "Marker"];
  }
  return LineType.other;
}

function transition(state, lineType) {
  var nextState = StateTransitions[state][lineType];
  if (typeof nextState === 'undefined') {
    nextState = State.error;
  }
  return {
    actions: Actions[state][lineType] || {},
    nextState
  }
}

export function validFile(lines) {
  var state = State.start;
  for (var line of lines) {
    let curLineType = lineType(line), {nextState} = transition(state, curLineType);
    if (nextState === State.error) {
      return false;
    }
    state = nextState;
  }
  return true;
}

export function readPersisted(lines) {
  var state = State.start;
  var base64Data = "";
  var bookmarks = [];
  for (var line of lines) {
    let curLineType = lineType(line), {nextState, actions} = transition(state, curLineType);
    if (nextState === State.error) {
      throw new Error("Invalid Casefile data");
    }
    if (actions.collect) {
      base64Data += line;
    }
    if (actions.deserialize) {
      let newBookmarks = JSON.parse(atob(base64Data));
      newBookmarks = derelativizePaths(newBookmarks);
      bookmarks.push(...newBookmarks);
    }
    state = nextState;
  }
  return bookmarks;
}

export function relativizePaths(contents) {
  return contents.map(function(bookmark) {
    return Object.assign({}, bookmark, {
      file: atom.project.relativizePath(bookmark.file)[1],
      children: relativizePaths(bookmark.children)
    });
  });
}

export function derelativizePaths(contents) {
  return contents.map(function(bookmark) {
    return Object.assign({}, bookmark, {
      file: findBestAbsolutePath(bookmark.file),
      children: derelativizePaths(bookmark.children)
    });
  });
}

function findBestAbsolutePath(filePath) {
  if (filePath[0] == '/') {
    return filePath;
  }
  
  for (const d of atom.project.getDirectories()) {
    const f = d.getFile(filePath);
    if (f.existsSync()) {
      return f.getPath();
    }
  }
  
  return filePath;
}
