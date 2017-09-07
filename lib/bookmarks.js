'use babel';

import { BufferedProcess, File } from 'atom';

export function openBookmark(filePath, line, text) {
  atom.workspace.open(filePath, {initialLine: line - 1}).then((editor) => {
    // Look for *text* around the line the cursor is now on
    const rowHasText = (i) => {
      const lineText = editor.lineTextForBufferRow(i);
      return lineText && lineText.includes(text);
    };
    if (rowHasText(line - 1)) {
      editor.setCursorBufferPosition(
        [line - 1, editor.lineTextForBufferRow(line - 1).indexOf(text)]
      );
      return;
    }
    for (let i = 1; i <= 10; ++i) {
      if (rowHasText(line - 1 + i)) {
        editor.setCursorBufferPosition(
          [line - 1 + i, editor.lineTextForBufferRow(line - 1 + i).indexOf(text)]
        );
        return;
      }
      if (rowHasText(line - 1 - i)) {
        editor.setCursorBufferPosition(
          [line - 1 - i, editor.lineTextForBufferRow(line - 1 - i).indexOf(text)]
        );
        return;
      }
    }
    // TODO: A more in-depth search would consult the git diff for this file
  });
}

const hunkMapping = /^@@\s*-?(\d+)(?:,(\d+))?\s+\+?(\d+)(?:,(\d+))?/;

// Return a Promise for {commit, hunks}, where each of hunks is an object
// with {currentStart, currentEnd, baseStart, baseEnd}.  Start/End pairs are
// like C++ iterators, half-closed at Start.  "Current" refers to the working
// tree version of the file, where "base" refers to the committed version at
// the given "commit" or HEAD (if unspecified).
function computeGitPeggingInfo(filePath, {commit=null}={}) {
  var promiseOfCommit = commit ? Promise.resolve({commit}) : readGitHeadCommit(filePath);
  return promiseOfCommit.then(({commit}) => {
    const target = new File(filePath);
    return new Promise(function (resolve, reject) {
      const hunks = [];
      new BufferedProcess({
        command: 'git',
        args: ['diff', '-U0', commit, '--', target.getBaseName()],
        stdout: function(data) {
          for (const line of data.split("\n").slice(0, -1)) {
            const parts = line.match(hunkMapping)
            if (parts) {
              hunks.push({
                baseStart: parseInt(parts[1]),
                baseEnd: parseInt(parts[1]) + parseInt(parts[2]),
                currentStart: parseInt(parts[3]),
                currentEnd: parseInt(parts[3]) + parseInt(parts[4])
              });
            }
          }
        },
        stderr: function(output) {
          console.log(output);
        },
        options: {
          cwd: target.getParent().getPath(),
          env: Object.assign({}, process.env, {PATH: '/usr/bin:/bin:/usr/local/bin'})
        },
        exit: function(code) {
          if (!code) {
            resolve({commit, hunks});
          } else {
            reject("Unable to diff file");
          }
        }
      });
    });
  })
}

export function readGitHeadCommit(filePath) {
  const target = new File(filePath);
  return new Promise(function (resolve, reject) {
    var commit = null;
    new BufferedProcess({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      stdout: function(data) {
        commit = data.trim();
      },
      stderr: function(output) {
        console.log(output);
      },
      options: {
        cwd: target.getParent().getPath(),
        env: Object.assign({}, process.env, {PATH: '/usr/bin:/bin:/usr/local/bin'})
      },
      exit: function(code) {
        if (!code) {
          resolve({commit});
        } else {
          reject("Unable to resolve current Git HEAD commit");
        }
      }
    });
  });
}

// Return a Promise for {line} and possibly {commit}.  The "line" returned
// indexes the committed version of the file (at the given commit or HEAD if
// unspecified).  If currentLine lies within a modified hunk, it is mapped to
// the committed version by linear interpolation within the modified hunk.
export function computePegLine(filePath, currentLine, {commit=null}={}) {
  return computeGitPeggingInfo(filePath, {commit}).then(function({commit, hunks}) {
    var currentOffset = 0;
    for (let hunk of hunks) {
      if (currentLine < hunk.currentStart) {
        return {line: currentLine - currentOffset, commit};
      } else if (hunk.currentStart <= currentLine && currentLine < hunk.currentEnd) {
        return {
          line: Math.floor(
            (currentLine - hunk.currentStart) / (hunk.currentEnd - hunk.currentStart) * (hunk.baseEnd - hunk.baseStart)
          ) + hunk.baseStart,
          commit
        };
      }
      currentOffset = hunk.currentEnd - hunk.baseEnd;
    }
    return {line: currentLine - currentOffset, commit};
  }).catch(function() {
    return {line: currentLine};
  });
}

// Return a Promise for {start, prime, end}, where "start" and "end" are
// a half-closed interval of line numbers encompassing the realistic range of
// line numbers in the working copy that could correspond to the given line
// of the committed file.  "prime" is a "best guess" line number in
// [start, end) expected to correspond to the committed line based on linear
// interpolation within the modified hunk.
export function computeCurrentLineRange(filePath, {line, commit}) {
  if (!commit) {
    return Promise.resolve({start: line, prime: line, end: line + 1});
  }
  
  return computeGitPeggingInfo(filePath, {commit}).then(function({hunks}) {
    var currentOffset = 0;
    for (let hunk of hunks) {
      if (line < hunk.baseStart) {
        return {start: line + currentOffset, prime: line + currentOffset, end: line + currentOffset + 1};
      } else if (hunk.baseStart <= line && line < hunk.baseEnd) {
        return {
          start: hunk.currentStart,
          prime: hunk.currentStart + Math.floor(
            (line - hunk.baseStart) / (hunk.baseEnd - hunk.baseStart) * (hunk.currentEnd - hunk.currentStart)
          ),
          end: hunk.currentEnd
        };
      } else if (hunk.baseStart == line) {
        return {
          start: hunk.currentStart,
          prime: Math.floor((hunk.currentStart + hunk.currentEnd) / 2),
          end: hunk.currentEnd
        }
      }
      currentOffset = hunk.currentEnd - hunk.baseEnd;
    }
  }).catch(function() {
    return {start: line, prime: line, end: line + 1};
  });
}
