'use babel';

import { BufferedProcess, File } from 'atom';
import tempy from 'tempy';
import {toolEnv} from './external-tools';

function splitIntoLines(s) {
  if (s.slice(-1) === "\n") {
    s = s.slice(0, -1);
  }
  return s.split("\n");
}

export function openBookmark({file: filePath, line, markText: text, peg: gitPeg}) {
  atom.workspace.open(filePath, {initialLine: line - 1}).then((editor) => {
    // Look for *text* around the line the cursor is now on
    const rowHasText = (i) => {
      const lineText = editor.lineTextForBufferRow(i);
      return lineText && lineText.includes(text);
    };
    
    const findAndSelectTextInRow = (i) => {
      if (rowHasText(i - 1)) {
        editor.setCursorBufferPosition(
          [i - 1, editor.lineTextForBufferRow(i - 1).indexOf(text)]
        );
        return true;
      }
      return false;
    }
    
    const attemptMarkLocationWithoutTracking = () => {
      if (findAndSelectTextInRow(line)) {
        return;
      }
      for (let i = 1; i <= 10; ++i) {
        if (findAndSelectTextInRow(line + i) || findAndSelectTextInRow(line - i)) {
          return;
        }
      }
    }
    
    if (gitPeg) {
      retrieveBlameMatchLine(filePath, gitPeg, editorContent(filePath)).then(
        ({line}) => {
          if (!findAndSelectTextInRow(line)) {
            console.warn(`CASEFILE blame was wrong, text not at ${line}`);
            return Promise.reject("Could not find text in editor at line given by blame");
          }
        }
      ).catch(() => 
        computeCurrentLineRange(filePath, gitPeg).then(function({start, prime, end}) {
          if (findAndSelectTextInRow(prime)) {
            return;
          }
          const iLimit = Math.max(prime - start - 1, end - prime);
          for (let i = 1; i < iLimit; ++i) {
            if (start <= prime - i && findAndSelectTextInRow(prime - i)) {
              return;
            } else if (prime + i < end && findAndSelectTextInRow(prime + i)) {
              return;
            }
          }
        })
      ).catch(function() {
        attemptMarkLocationWithoutTracking();
      });
      return;
    }
    
    attemptMarkLocationWithoutTracking();
  });
}

const hunkMapping = /^@@\s*-?(\d+)(?:,(\d+))?\s+\+?(\d+)(?:,(\d+))?/;

// Return a Promise for {commit, hunks}, where each of hunks is an object
// with {currentStart, currentEnd, baseStart, baseEnd}.  Start/End pairs are
// like C++ iterators, half-closed at Start.  "Current" refers to the working
// tree version of the file, where "base" refers to the committed version at
// the given "commit" or HEAD (if unspecified).
function computeGitPeggingInfo(filePath, {commit=null}={}) {
  const target = new File(filePath);
  
  const promiseOfCommit = commit ? Promise.resolve({commit}) : readGitHeadCommit(filePath);
  
  var promiseOfCurrentContentFile = Promise.resolve(filePath);
  const currentContentPane = atom.workspace.paneForURI(filePath);
  if (currentContentPane) {
    const editor = currentContentPane.itemForURI(filePath);
    if (editor && editor.isModified()) {
      const currentContentFile = tempy.file();
      promiseOfCurrentContentFile = new File(currentContentFile).write(editor.getText()).then(function() {
        return currentContentFile;
      });
    }
  }
  
  const promiseOfBaseContentFile = new Promise(function(resolve, reject) {
    const baseContentFile = tempy.file();
    var baseContent = "";
    new BufferedProcess({
      command: 'git',
      args: ['show', (commit || 'HEAD') + ':./' + target.getBaseName()],
      stdout: function(data) {
        baseContent = baseContent + data;
      },
      stderr: function(output) {
        console.log(output);
      },
      options: {
        cwd: target.getParent().getPath(),
        env: toolEnv()
      },
      exit: function(code) {
        if (!code) {
          resolve(
            new File(baseContentFile)
            .write(baseContent)
            .then(function() {
              return baseContentFile;
            })
          );
        } else {
          reject("Unable to read base version of file");
        }
      }
    }).onWillThrowError((errObj) => {
      reject("Unable to run git");
      console.log(errObj.error);
      errObj.handle();
    })
  });
  
  return (
    Promise.all([
      promiseOfCommit,
      promiseOfBaseContentFile,
      promiseOfCurrentContentFile
    ]).then(function([commit, baseContentFile, currentContentFile]) {
      return new Promise(function (resolve, reject) {
        const hunks = [];
        new BufferedProcess({
          command: 'diff',
          args: ['-U0', baseContentFile, currentContentFile],
          stdout: function(data) {
            for (const line of data.split("\n").slice(0, -1)) {
              const parts = line.match(hunkMapping)
              if (parts) {
                const newHunk = {
                  baseStart: parseInt(parts[1]),
                  baseEnd: parseInt(parts[1]) + parseInt(parts[2] || "1"),
                  currentStart: parseInt(parts[3]),
                  currentEnd: parseInt(parts[3]) + parseInt(parts[4] || "1")
                };
                if (parts[2] == "0") {
                  newHunk.baseStart = newHunk.baseEnd = newHunk.baseStart + 1;
                }
                if (parts[4] == "0") {
                  newHunk.currentStart = newHunk.currentEnd = newHunk.currentStart + 1;
                }
                hunks.push(newHunk);
              }
            }
          },
          stderr: function(output) {
            console.log(output);
          },
          options: {
            env: toolEnv()
          },
          exit: function(code) {
            if (code === 0 || code === 1) {
              resolve({commit, hunks});
            } else {
              reject("Unable to diff file");
            }
          }
        }).onWillThrowError((errObj) => {
          reject("Unable to run diff");
          console.log(errObj.error);
          errObj.handle();
        });
      });
    })
  );
}

function computeGitBlameInfo(filePath, line, {commit} = {}) {
  // Promises a {line, commit}
  const target = new File(filePath), result = {};
  const args = ['blame', '-L', `${line},${line}`, '--porcelain'];
  let modifiedContent = '';
  if (commit) {
    args.push(commit);
  } else {
    const currentContentPane = atom.workspace.paneForURI(filePath);
    if (currentContentPane) {
      const editor = currentContentPane.itemForURI(filePath);
      if (editor && editor.isModified()) {
        // We have to feed the content of the editor to stdin
        modifiedContent = editor.getText();
        args.push('--content', '-');
      }
    }
  }
  args.push('--', target.getBaseName());
  let firstLineProcessed = false;
  
  return new Promise(function(resolve, reject) {
    const proc = new BufferedProcess({
      command: 'git',
      args,
      options: {
        cwd: target.getParent().getPath(),
        env: toolEnv()
      },
      stderr: function (output) {
        console.log(output);
      },
      stdout: function(data) {
        if (firstLineProcessed) return;
        const firstLine = data.split('\n', 1)[0];
        [result.commit, result.line] = firstLine.split(' ');
        result.line = Number(result.line);
        if (result.commit === '0000000000000000000000000000000000000000') {
          delete result.commit;
        }
        firstLineProcessed = true;
      },
      exit: function(code) {
        if (code === 0 && result.commit) {
          resolve(result);
        } else {
          reject(`No commit known for line ${line} of ${filePath}`);
        }
      }
    });
    proc.onWillThrowError(function(errObj) {
      reject("Unable to run blame");
      console.log(errObj.error);
      errObj.handle();
    });
    
    proc.process.stdin.end(modifiedContent);
  });
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
        env: toolEnv()
      },
      exit: function(code) {
        if (!code) {
          resolve(commit);
        } else {
          reject("Unable to resolve current Git HEAD commit");
        }
      }
    }).onWillThrowError((errObj) => {
      reject("Unable to run git");
      console.log(errObj.error);
      errObj.handle();
    });
  });
}

// Return a Promise for {line} and possibly {commit}.  The "line" returned
// indexes the committed version of the file (at the given commit or HEAD if
// unspecified).  If currentLine lies within a modified hunk, it is mapped to
// the committed version by linear interpolation within the modified hunk.
export function computePegLine(filePath, currentLine, {commit=null}={}) {
  return computeGitBlameInfo(filePath, currentLine, {commit}).then(
    ({line, commit}) => ({line, commit}),
    () =>
      computeGitPeggingInfo(filePath, {commit}).then(function({commit, hunks}) {
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
      })
  );
}

// Return a Promise for {start, prime, end}, where "start" and "end" are
// a half-closed interval of line numbers encompassing the realistic range of
// line numbers in the working copy that could correspond to the given line
// of the committed file.  "prime" is a "best guess" line number in
// [start, end) expected to correspond to the committed line based on linear
// interpolation within the modified hunk.
export function computeCurrentLineRange(filePath, {line, commit}) {
  line = Number(line);
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
    return {start: line + currentOffset, prime: line + currentOffset, end: line + currentOffset + 1};
  }).catch(function() {
    return {start: line, prime: line, end: line + 1};
  });
}

function editorContent(filePath) {
  const currentContentPane = atom.workspace.paneForURI(filePath);
  if (!currentContentPane) {
    return;
  }
  const editor = currentContentPane.itemForURI(filePath);
  if (!editor) {
    return;
  }
  return editor.getText();
}

function retrieveBlameMatchLine(filePath, {commit, line}, content) {
  // Proimse for {line}
  const soughtLine = Number(line);
  const target = new File(filePath);
  return new Promise(function(resolve, reject) {
    const commitLinePattern = new RegExp(
      `^${commit} (?<sourceline>\\d+) (?<resultline>\\d+) (?<span>\\d+)`
    );
    const proc = new BufferedProcess({
      command: 'git',
      options: {
        env: toolEnv(),
        cwd: target.getParent().getPath()
      },
      args: ['blame', '--incremental', '--contents', '-', '--', target.getBaseName()],
      stdout: function(chunk) {
        // Iterate lines in the chunk
        const lines = splitIntoLines(chunk);
        for (const line of lines) {
          // Look for lines that match the useful pattern
          const m = commitLinePattern.exec(line);
          if (!m) continue;
          
          // Extract the span parameters
          const m_values = {sourceline: null, resultline: null, span: null};
          for (let k of Object.keys(m_values)) {
            m_values[k] = Number(m.groups[k]);
          }
          const {sourceline, resultline, span} = m_values;
          
          if (sourceline <= soughtLine && soughtLine < sourceline + span) {
            resolve({line: resultline + soughtLine - sourceline});
          }
        }
      },
      stderr: function(output) {
        console.log(output);
      },
      exit: function(code) {
        if (code === 0) {
          reject("No matching line found");
        } else {
          reject("Error executing git blame");
        }
      }
    });
    proc.onWillThrowError(function(errObj) {
      reject("Unable to run blame");
      console.log(errObj.error);
      errObj.handle();
    });
    
    proc.process.stdin.end(content);
  });
}
