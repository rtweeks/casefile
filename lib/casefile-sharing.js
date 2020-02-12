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

export function promiseToGetListOfRemotes() {
  return new Promise(function (resolve, reject) {
    var remotes = [];
    new BufferedProcess({
      command: 'git',
      args: ['remote'],
      stdout: function(remoteName) {
        remotes.push(remoteName.trim());
      },
      stderr: function(output) {
        console.warn(output);
      },
      options: gitOptions(),
      exit: function(code) {
        if (!code) {
          resolve(remotes);
        } else {
          reject("Unable to list Git remotes");
        }
      }
    }).onWillThrowError(function(errObj) {
      reject("Unable to run git while trying to list Git remotes");
      console.error(errObj.error);
      errObj.handle();
    });
  });
}

export function promiseToFetchSharedCasefilesFromRemote(remoteName) {
  return new Promise(function (resolve, reject) {
    new BufferedProcess({
      command: 'git',
      args: ['fetch', remoteName, sharedCasefilesRef + ":" + sharedCasefilesRef],
      stderr: function(output) {
        console.log(output);
      },
      options: gitOptions(),
      exit: function(code) {
        if (!code) {
          resolve(null);
        } else {
          reject("Unable to fetch from Git remote");
        }
      }
    }).onWillThrowError(function (errObj) {
      reject("Unable to run git while trying to fetch from remote");
      console.error(errObj.error);
      errObj.handle();
    });
  });
}

const gitLsTreeEntryRegex = /^(?<mode>\S+) (?<type>\S+) (?<hash>\S+)\t(?<cfPath>(?<cfName>[^/]+)\/[^/]+)$/;
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
  return new Promise(function(resolve, reject) {
    var lsTreeOutput = [];
    new BufferedProcess({
      command: 'git',
      args: ['ls-tree', '-rz', '--full-tree', sharedCasefilesRef],
      stdout: function(line) {
        lsTreeOutput.push(line);
      },
      stderr: function(output) {
        console.log(output);
      },
      options: gitOptions(),
      exit: function (code) {
        if (!code) {
          const casefiles = [];
          lsTreeOutput.join('').split('\0').forEach(entry => {
            var match = gitLsTreeEntryRegex.exec(entry);
            if (!match || match.groups.mode != '100644' || match.groups.type != 'blob') return;
            let prevCasefile = casefiles.slice(-1)[0] || {};
            let instance = {path: match.groups.cfPath};
            if (prevCasefile.name !== match.groups.cfName) {
              casefiles.push({name: match.groups.cfName, instances: [instance]});
            } else {
              prevCasefile.instances.push(instance);
            }
          });
          resolve(casefiles);
        } else {
          resolve([]);
        }
      }
    }).onWillThrowError(function (errObj) {
      reject("Unable to run git while trying to list known, shared casefiles");
      console.error(errObj.error);
      errObj.handle();
    });
  });
}

export function promiseToGetAuthors(path) {
  return new Promise(function(resolve, reject) {
    const authors = [];
    new BufferedProcess({
      command: 'git',
      args: ['log', '--pretty=format:%aN', sharedCasefilesRef, '--', path],
      stdout: function(author) {
        author = author.trim();
        if (authors.indexOf(author) < 0) {
          authors.push(author);
        }
      },
      stderr: function(output) {
        console.log(output);
      },
      options: gitOptions(),
      exit: function (code) {
        if (!code) {
          authors.sort();
          resolve({path, authors});
        } else {
          reject();
        }
      }
    }).onWillThrowError(function (errObj) {
      reject("Unable to run git while trying to list authors of a casefile group")
    });
  });
}

export function promiseToGetContentLines(path) {
  return new Promise(function(resolve, reject) {
    const contentLines = [];
    new BufferedProcess({
      command: 'git',
      args: ['show', sharedCasefilesRef + ':' + path],
      stdout: function(chunk) {
        contentLines.push(...chunk.split("\n"));
      },
      stderr: function(output) {
        console.log(output);
      },
      options: gitOptions(),
      exit: function(code) {
        if (!code) {
          resolve(contentLines);
        } else {
          reject("Exited with code " + code);
        }
      }
    }).onWillThrowError(function (errObj) {
      reject("Unable to run git while trying to retrieve casefile contents");
    });
  });
}

// TODO: Writing a new refs/collaboration/shared-casefiles commit
//    * `git rev-parse refs/collaboration/shared-casefiles` (may fail):
//      * on success: insert (trimmed) output into <parent-commits> and also set <current-casefiles-treeish> to the (trimmed) output
//      * on failure: <parent-commits> is empty Array, <current-casefiles-treeish> is gitEmptyTree
//    * `git write-object` of the JSON.stringify()'d  content -> new casefile entry
//    * `git ls-tree --full-tree <current-casefiles-treeish> <casefile-name>` (may be empty) -> casefile group
//    * `git mktree` from casefile group entries and new casefile entry -> new casefile group entry
//    * `git ls-tree --full-tree <current-casefiles-treeish>` (may be empty) -> casefile groups list
//    * `git mktree` from casefile groups list entries, adding or substituting new casefile group entry -> casefiles tree
//    * `git commit-tree` from casefiles tree -> new commit
//    * `git update-ref refs/collaboration/shared-casefiles <new-commit>`
//    * `git push <remote> refs/collaboration/shared-casefiles` using <parent-commits> (0 or 1) for parent(s)
