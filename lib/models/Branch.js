'use strict';

import Model from './Model.js';

const Branch = Model.define('Branch', {
  attributes: ['id', 'branch', 'active', 'tracksFileRenames', 'latestCommit'],
  keyAttribute: 'id',
});

Branch.persist = function (nBranch) {
  return Branch.findById(nBranch.id).then(function (instance) {
    if (!instance) {
      return Branch.create({
        id: nBranch.id,
        branch: nBranch.branchName,
        active: nBranch.currentActive,
        tracksFileRenames: nBranch.tracksFileRenames,
        latestCommit: nBranch.latestCommit,
      }).then((branch) => [branch, true]);
    }
    return [instance, false];
  });
};

export default Branch;
