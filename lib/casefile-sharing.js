'use babel';

import { BufferedProcess, File } from 'atom';
import tempy from 'tempy';
import {toolEnv} from './external-tools';

const sharedCasefilesRef = 'refs/collaboration/shared-casefiles';

/*
General gist: use refs/shared-casefiles (locally and remotely) to store a tree
of blobs like:

    <casefile-name>/<hash>

For each <casefile-name> in the tree, the import UI looks different depending
on whether there are one or more contained <hash>es.  When only one <hash> is
present under the <casefile-name>, only the single option for the
<casefile-name> is presented.  When multiple <hash>es are present, the user
may pick one or more to load, and the different casefiles are shown in the UI
by the email addresses of the users who authored changes to the blob and the
date of last modification (not the hash, which is meaningless).  If the user
selects only one casefile within the name-group, import proceeds as if only
one <hash> were present for the name-group.

When importing a single casefile (including when one of many sharing the same
name is chosen), the result depends on whether there are any bookmarks in the
current casefile.  If the active casefile is empty, all bookmarks from the
shared casefile are imported at the top level and the selected
<casefile-name>/<hash> is saved as the default sharing location.  If there _are_
bookmarks in the active casefile, the bookmarks from the imported casefile are
placed under a header-bookmark with the <casefile-name> and the default sharing
location is <casefile-name>/<newly-generated-hash>.

When multiple casefiles from a named group are imported, each casefile
should have its own "header" bookmark and its bookmarks be imported under
that header.  The header notes should include the authors who contributed to
that particular casefile.  In this case, the default sharing location is
<casefile-name>/<newly-generated-hash>.

The UI should provide a button to fetch the refs/shared-casefiles from the
remote and also a dropdown to select the remote with which casefiles are
shared.

Use `git write-object`, `git mktree`, and `git commit-tree` to build the shared
casefile tree outside of the index, to avoid interfering with normal use of
the repository.

It may also be good to support refs/local-casefiles for casefiles that aren't
shared to a remote repository.

When generating a new hash for a shared (or locally saved) casefile, include
machine name, user name, date, time, and a random value as input to the hashing
function.

TODO: Give more thought to the "default sharing location" -- might need to
prompt the user if the active casefile already has a default sharing location.
*/

const gitEmptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function primaryProjectPath() {
  return atom.project.getPaths()[0];
}

function gitOptions() {
  return {
    env: toolEnv(),
    cwd: primaryProjectPath()
  }
}

const endOfLine = /(?<=\n)/;
const endOfNTE = /(?<=\0)/;

function splitIntoLines(s) {
  if (s.slice(-1) === "\n") {
    s = s.slice(0, -1);
  }
  return s.split("\n");
}

/**
 * Call iteratee once for each NUL-terminated entry in s; trailing characters
 * (or an empty string) are returned.
 */
function forEachNTE(s, iteratee) {
  let lastTerm = -1;
  for (let i = -1; (i = s.indexOf('\0', i + 1)) >= 0; ) {
    const entry = s.slice(lastTerm + 1, i);
    iteratee(entry);
    lastTerm = i;
  }
  return s.slice(lastTerm + 1);
}

function makeEnum(spaceSeparatedTerms) {
  const result = {};
  spaceSeparatedTerms.split(' ').forEach(s => {result[s] = s;});
  return result;
}

function promiseToRunGitCommand(command, options) {
  /**
   * command - Git subcommand to run
   * options (Object)
   *   args - (optional) Arguments to Git subcommand
   *   operationDescription - (optional) String describing this operation, used for error messages
   *   feedStdin - (optional) Function that receives the stdin <stream.Writable>
   *   stdout - Standard output handler for BufferedProcess (receives 1 or more lines of output, final output may not end in full line)
   *   exit - (conditional) Full exit event handler for BufferedProcess (receives 'code'); returned value is resolution value of the Promise, thrown value is the rejection value of the Promise
   *   makeResult - (conditional) Function returning the value with which to resolve the Promise on success
   *   result - (conditional) Value with which to resolve the Promise on success
   *
   * The first of the following properties of options determines result handling:
   *   * exit
   *   * makeResult
   *   * result
   */
  return new Promise(function(resolve, reject) {
    // Figure out exit handling
    let exit = null;
    if (options.exit) {
      exit = function(code) {
        try{
          resolve(options.exit(code));
        } catch (ex) {
          reject(ex.toString());
        }
      }
    } else {
      if (!('result' in options) && !('makeResult' in options)) {
        throw "options must specify either exit, makeResult, or result";
      }
      exit = function(code) {
        if (!code) {
          if (options.makeResult) {
            try {
              resolve(options.makeResult());
            } catch (ex) {
              reject(ex);
            }
          } else {
            resolve(options.result);
          }
        } else if (options.operationDescription) {
          reject(`Unable to ${options.operationDescription}`);
        } else {
          reject(`'git ${command}' exited with code ${code}`);
        }
      };
    }
    
    // Start the process
    const gitProcess = new BufferedProcess({
      command: 'git',
      args: [command].concat(options.args || []),
      options: gitOptions(),
      stderr: function (output) {
        console.warn(output);
      },
      stdout: options.stdout,
      exit
    });
    gitProcess.onWillThrowError(options.spawnError || function (errObj) {
      reject(`Unable to run git while trying to ${options.operationDescription || command}`)
      console.error(errObj.error);
      errObj.handle();
    });
    
    // Handle input
    const {stdin} = gitProcess.process;
    if (options.feedStdin) {
      options.feedStdin(stdin);
    }
    if (!stdin.writableEnded) {
      stdin.end();
    }
  });
}

export function promiseToGetListOfRemotes() {
  var remotes = [];
  return promiseToRunGitCommand('remote', {
    operationDescription: 'list Git remotes',
    stdout: function(remoteNames) {
      const names = remoteNames.trim().split('\n').map(n => n.trim());
      remotes.push(...names);
    },
    result: remotes
  });
}

export function promiseToFetchSharedCasefilesFromRemote(remoteName) {
  return promiseToRunGitCommand('fetch', {
    args: [remoteName, `+${sharedCasefilesRef}*:${sharedCasefilesRef}*`],
    operationDescription: `fetch shared casefiles ref from Git remote '${remoteName}'`,
    result: null
  });
}

const gitLsTreeCasefileEntryRegex = /^(?<mode>\S+) (?<type>\S+) (?<hash>\S+)\t(?<cfPath>(?<cfName>[^/]+)\/[^/]+)$/;
/**
 *  Resolves to a list of Objects with these properties:
 *    name::
 *      Human readable String identifying the casefile group
 *    instances::
 *      Array of Objects each representing a shared casefile within this group,
 *      conforming to SharedCasefile
 *
 *  SharedCasefile objects have the following properties:
 *    path::
 *      Path of the shared casefile instance within the Git tree
 */
export function promiseToGetListOfCasefiles() {
  var lsTreeOutput = [];
  return promiseToRunGitCommand('ls-tree', {
    args: ['-rz', '--full-tree', sharedCasefilesRef],
    operationDescription: "list known, shared casefiles",
    stdout: function(chunk) {
      lsTreeOutput.push(chunk);
    },
    exit: function (code) {
      if (!code) {
        const casefiles = [];
        lsTreeOutput.join('').split(endOfNTE).forEach(entry => {
          const match = gitLsTreeCasefileEntryRegex.exec(entry.slice(0, -1));
          if (!match || match.groups.mode !== '100644' || match.groups.type !== 'blob') return;
          const prevCasefile = casefiles.slice(-1)[0] || {};
          const instance = {path: match.groups.cfPath};
          if (prevCasefile.name !== match.groups.cfName) {
            casefiles.push({name: match.groups.cfName, instances: [instance]});
          } else {
            prevCasefile.instances.push(instance);
          }
        });
        return casefiles;
      } else {
        return [];
      }
    }
  });
}

export function promiseToGetAuthors(path) {
  const authors = [];
  return promiseToRunGitCommand('log', {
    args: ['--pretty=format:%aN', sharedCasefilesRef, '--', path],
    operationDescription: `list authors of casefile group '${path}'`,
    stdout: function(newAuthors) {
      splitIntoLines(newAuthors).forEach(author => {
        if (authors.indexOf(author) < 0) {
          authors.push(author);
        }
      });
    },
    makeResult: function() {
      authors.sort();
      return ({path, authors});
    }
  });
}

export function promiseToGetContentLines(path, {beforeCommit} = {}) {
  const contentLines = [];
  let commitPromise = Promise.resolve(sharedCasefilesRef);
  if (beforeCommit) {
    commitPromise = promiseToFindLatestCommitParentWithPath(path, beforeCommit);
  }
  return commitPromise.then(commit => 
    promiseToRunGitCommand('show', {
      args: [`${commit}:${path}`],
      operationDescription: `retrieve contents of casefile '${path}'`,
      stdout: function(chunk) {
        contentLines.push(...splitIntoLines(chunk));
      },
      result: contentLines
    })
  );
}

function promiseToFindLatestCommitParentWithPath(path, beforeCommit) {
  // Promises a commit hash
  const parents = [];
  return promiseToRunGitCommand('rev-parse', {
    args: [beforeCommit + '^@'],
    operationDescription: `identify parents of ${beforeCommit}`,
    stdout: function(chunk) {
      parents.push(...splitIntoLines(chunk));
    },
    result: null
  }).then(() => 
    parents.map(commit => 
      promiseToGetDateOfLastChange(path, {commit}).then(
        date => [{commit, date}],
        () => []
      )
    ).reduce(
      (bestYetPromise, newDataPromise) => bestYetPromise.then(bestYet => 
        newDataPromise.then(([newData]) =>
          (!newData || bestYet.date > newData.date)? bestYet : newData
        )
      ),
      Promise.resolve({date: 0})
    )
  ).then(bestParent => 
    bestParent.commit
  );
}

function promiseToGetDateOfLastChange(path, {commit = 'HEAD'} = {}) {
  // Promises a Number value for the timestamp of last change to *path* as of *commit*
  let result = 0;
  return promiseToRunGitCommand('log', {
    args: ['--pretty=format:%ci', '-n1', commit, '--', path],
    operationDescription: `query date '${path}' last committed in ${commit}`,
    stdout: function(chunk) {
      result = new Date(chunk.trim()).getTime();
    },
    makeResult: () => result
  });
}

export function promiseToFetchFromRemote(remote) {
  return promiseToRunGitCommand('fetch', {
    args: [remote],
    operationDescription: `fetch remote '${remote}'`,
    result: null
  });
}

export function promiseToSelectCommitsUnknownToRemote(remote, commits) {
  // TODO: Check if repository is _weird_: if fetch and push URLs are the
  // same and refspecs are `+refs/heads/*:refs/remotes/${remote}/*`, because
  // promiseToTestIfCommitKnownToRemote has those expectations.
  let work = Promise.resolve([]);
  const parallel = 8;
  for (let i = 0; i * parallel < commits.length; ++i) {
    const workSlice = commits.slice(i * parallel, (i + 1) * parallel);
    work = work.then(found => 
      workSlice.map(commit => 
        promiseToTestIfCommitKnownToRemote(remote, commit).then(commitKnown => 
          commitKnown ? [] : [commit]
        )
      ).reduce((accum, next) => accum.then(next), Promise.resolve([])).then(newlyFound =>
        found.concat(newlyFound)
      )
    );
  }
  return work;
}

function promiseToTestIfCommitKnownToRemote(remote, commit) {
  let outputReceived = false;
  return promiseToRunGitCommand('branch', {
    args: ['-r', '--contains', commit, `${remote}/*`],
    stdout: function() {
      outputReceived = true;
    },
    result: outputReceived
  });
}

export function promiseToShareCasefile(remote, path, bookmarks) {
  const parentCommits = [], [group, instance] = path.split('/');
  let currentCasefilesTree = gitEmptyTree;
  let casefileHash = null, groupTreeHash;
  return promiseToRevParse(sharedCasefilesRef).then(
    refCommit => {
      parentCommits.push(refCommit);
      currentCasefilesTree = refCommit;
    },
    () => null
  ).then(() => 
    promiseToGetHashOfCasefile(bookmarks).then(hash => {
      casefileHash = hash;
    })
  ).then(() =>
    promiseToLsTree(`${currentCasefilesTree}:${group}`)
  ).then(groupTreeEntries => {
    const existingIndex = groupTreeEntries.findIndex(({name}) => name === instance);
    const newEntry = {mode: '100644', type: 'blob', hash: casefileHash, name: instance};
    if (existingIndex < 0) {
      groupTreeEntries.push(newEntry);
    } else if (groupTreeEntries[existingIndex].hash === casefileHash) {
      return Promise.reject("Current casefile contents already shared");
    } else {
      groupTreeEntries.splice(existingIndex, 1, newEntry);
    }
    return promiseToMktree(groupTreeEntries).then(result => {groupTreeHash = result;});
  }).then(() => 
    promiseToLsTree(currentCasefilesTree)
  ).then(rootTreeEntries => {
    rootTreeEntries = rootTreeEntries.filter(({name}) => name !== group);
    rootTreeEntries.push({mode: '040000', type: 'tree', hash: groupTreeHash, name: group});
    return promiseToMktree(rootTreeEntries);
  }).then(newTree => 
    promiseToCommitCasefilesTree(newTree, {parents: parentCommits, message: "Share casefile"})
  ).then(newCommit =>
    promiseToPush(remote, {source: newCommit, dest: sharedCasefilesRef}).then(() => newCommit)
  ).then(newCommit =>
    promiseToUpdateRef(sharedCasefilesRef, newCommit)
  );
}

export function promiseToDeleteCasefilePaths(remote, paths) {
  // Compute groups
  const groups = paths.reduce(
    (r, p) => {
      r.set(p.split('/', 1)[0], null)
      return r;
    },
    new Map()
  ), parentCommits = [];
  let currentCasefilesTree = gitEmptyTree;

  return promiseToRevParse(sharedCasefilesRef).then(
    refCommit => {
      parentCommits.push(refCommit);
      currentCasefilesTree = refCommit;
    },
    () => null
  ).then(() =>
    // For each group...
    Promise.all(Array.from(groups.keys()).map(group => 
      // 'git ls-tree' the entries of the group
      promiseToLsTree(`${sharedCasefilesRef}:${group}`).then(entries => {
        // Remove any entries matching *paths*
        const remainingEntries = entries.filter(e => 
          paths.indexOf(`${group}/${e.name}`) < 0
        );
        
        // If some entries left...
        if (remainingEntries.length > 0) {
          // Create tree ('git mktree') for the revised group
          return promiseToMktree(remainingEntries);
        } else {
          // Otherwise, associate null with the group
          return Promise.resolve(null);
        }
      }).then(groupTree => {
        groups.set(group, groupTree);
      })
    ))
  ).then(() => 
    // 'git ls-tree' the root of the repo
    promiseToLsTree(sharedCasefilesRef)
  ).then(rootEntries =>
    // Update or delete entries of root
    rootEntries.flatMap(entry => {
      if (!groups.has(entry.name)) {
        return [entry];
      } else if (groups.get(entry.name) === null) {
        return [];
      } else {
        return [{
          mode: '040000',
          type: 'tree',
          hash: groups.get(entry.name),
          name: entry.name
        }];
      }
    })
  ).then(newRootEntries =>
    // Create tree ('git mktree') for the revised root
    promiseToMktree(newRootEntries)
  ).then(newRootTree =>
    // Create commit for the updated tree
    promiseToCommitCasefilesTree(newRootTree, {parents: parentCommits, message: "Delete casefile(s)"})
  ).then(newCommit =>
    // Push new commit to remote
    promiseToPush(remote, {source: newCommit, dest: sharedCasefilesRef}).then(() => newCommit)
  ).then(newCommit =>
    // Update local ref
    promiseToUpdateRef(sharedCasefilesRef, newCommit)
  );
}

function promiseToRevParse(committish) {
  // Promises a hash (reject if not available)
  let result = null;
  return promiseToRunGitCommand('rev-parse', {
    args: [committish],
    operationDescription: `resolve '${committish}' to a commit hash`,
    stdout: function (output) {
      result = output.trim();
    },
    makeResult: function() {
      if (!result || result.length === 0) {
        throw "Invalid committish";
      }
      return result;
    }
  });
}

function promiseToGetHashOfCasefile(bookmarks) {
  // Promises a hash of the file representing bookmarks
  let result = null;
  return promiseToRunGitCommand('hash-object', {
    args: ['-w', '--stdin'],
    operationDescription: 'write casefile into Git blob',
    feedStdin: function(stdin) {
      stdin.write(JSON.stringify({bookmarks}));
    },
    stdout: function (hash) {
      result = hash.trim();
    },
    makeResult: function () {
      if (!result || result.length === 0) {
        throw "Write failed (no hash returned)";
      }
      return result;
    }
  });
}

const gitLsTreeEntryRegex = /^(?<mode>\S+) (?<type>\S+) (?<hash>\S+)\t(?<name>.+)$/;
function promiseToLsTree(treeish) {
  // Promises an Array of {mode, type, hash, name} Objects
  const lsTreeOutput = [];
  return promiseToRunGitCommand('ls-tree', {
    args: ['-z', '--full-tree', treeish],
    operationDescription: `list contents of '${treeish}'`,
    stdout: function (chunk) {
      lsTreeOutput.push(chunk);
    },
    exit: function (code) {
      if (!code) {
        return lsTreeOutput.join('').split(endOfNTE).flatMap(entry => {
          const match = gitLsTreeEntryRegex.exec(entry.slice(0, -1));
          if (!match) return [];
          return [match.groups];
        });
      } else {
        return [];
      }
    }
  });
}

function promiseToMktree(entries) {
  // Promises a hash of the tree
  let result = null;
  return promiseToRunGitCommand('mktree', {
    args: ['-z'],
    operationDescription: 'build Git tree object',
    feedStdin: function(stdin) {
      entries.forEach(entry => {
        stdin.write(`${entry.mode} ${entry.type} ${entry.hash}\t${entry.name}\0`);
      });
    },
    stdout: function (output) {
      result = output.trim();
    },
    makeResult: function () {
      if (!result || result.length === 0 || result === gitEmptyTree) {
        throw "Invalid mktree result";
      }
      return result;
    }
  });
}

function promiseToCommitCasefilesTree(tree, {parents = [], message} = {}) {
  // Promises a commit hash
  const parentArgs = parents.flatMap(p => ['-p', p]);
  let result = null;
  return promiseToRunGitCommand('commit-tree', {
    args: parentArgs.concat(['-m', message, tree]),
    operationDescription: `creating commit for tree ${tree}`,
    stdout: function (hash) {
      result = hash.trim();
    },
    makeResult: function () {
      if (!result || result.length === 0) {
        throw "Invalid commit hash";
      }
      return result;
    }
  });
}

function promiseToUpdateRef(refName, commit) {
  return promiseToRunGitCommand('update-ref', {
    args: [refName, commit],
    operationDescription: `updating Git ref '${refName}' to ${commit}`,
    result: null
  });
}

function promiseToPush(remote, {source, dest, force}) {
  return promiseToRunGitCommand('push', {
    args: [remote, `${force ? '+' : ''}${source}:${dest}`],
    operationDescription: `${force ? 'force ' : ''}push ${source} to ${dest} on ${remote}`,
    result: null
  });
}

const DeletedCasefileListingStates = makeEnum('action path');

const deletedCasefileCommitInfoRegex = /- (?<commit>\S+) (?<committed>\S+ \S+ \S+)/;
// Use `git log --diff-filter=D --name-status '--pretty=format:- %H %ci' -- '*<partial>*'` to list available
export function promiseToGetDeletedCasefileRefs(partial) {
  // Promises an Array of {commit, committed, path}
  //   * commit is the hash of the commit deleting the casefile
  //   * committed is the timestamp of the delete
  //   * path is the full path (including instance designator) of the deleted casefile
  const args = [];
  args.push('-z'); // NUL-separate diff items
  args.push('--diff-filter=D'); // Only list deleted files
  args.push('--name-status'); // Only show file names, not patch
  args.push('--pretty=format:- %H %ci'); // Format the commit indication line as expected
  args.push(sharedCasefilesRef); // Search our special ref
  if (partial && partial.length > 0) {
    args.push('--', `*${partial}*/*`);
  }
  
  const deletedCasefiles = [], State = DeletedCasefileListingStates;
  let remainder = '', parseState = State.action, commitInfo = null;
  
  return promiseToRunGitCommand('log', {
    args,
    operationDescription: 'get a list of deleted casefiles',
    stdout: function(chunk) {
      remainder = forEachNTE(remainder + chunk, (rec) => {
        switch (parseState) {
          case State.action:
            if (rec.length === 0) {
              // Empty record before next commit in log
              break;
            }
            if (rec.startsWith('-')) {
              // The first line of rec is a commit info line
              const lineEnd = rec.indexOf('\n'), ciRec = rec.slice(0, lineEnd);
              rec = rec.slice(lineEnd + 1);
              
              // Process the commit info
              const match = deletedCasefileCommitInfoRegex.exec(ciRec);
              if (match) {
                commitInfo = match.groups;
              }
            }
            // Always rec === 'D'
            parseState = State.path;
            break;
            
          case State.path:
            // rec is path to add to deletedCasefiles
            deletedCasefiles.push({
              commit: commitInfo.commit,
              committed: commitInfo.committed,
              path: rec
            });
            parseState = State.action;
            break;
        }
      });
    },
    exit: function(code) {
      if (!code) {
        return deletedCasefiles;
      } else {
        return [];
      }
    }
  });
}
