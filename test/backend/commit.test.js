'use strict';

import { expect } from 'chai';

import fake from './helper/git/repositoryFake.js';
import helpers from './helper/git/helpers.js';
import GatewayMock from './helper/gateway/gatewayMock';

import Db from '../../lib/core/db/db';
import Commit from '../../lib/models/Commit';
import File from '../../lib/models/File';
import Language from '../../lib/models/Language';
import Hunk from '../../lib/models/Hunk';
import LanguageFileConnection from '../../lib/models/LanguageFileConnection';
import CommitStakeholderConnection from '../../lib/models/CommitStakeholderConnection.js';
import conf from '../../lib/config.js';

import ctx from '../../lib/context';
import GitHubUrlProvider from '../../lib/url-providers/GitHubUrlProvider';
import Stakeholder from '../../lib/models/Stakeholder.js';
const config = conf.get();

describe('commit', function () {
  const db = new Db(config.arango);
  const gateway = new GatewayMock();
  const bob = { name: 'Bob Barker', email: 'bob@gmail.com' };

  const testFile = 'function helloWorld(){\nconsole.log("Hello World");\n}';
  const testFileChanged = 'function helloWorld(){\nconsole.log("Hello World!");\n}';
  const testFileChangedAgain =
    'function helloWorld(){\nconsole.log("Hello");\nconsole.log("Hello World!");\nconsole.log("World");\nconsole.log("!");\n}';

  describe('#persit', function () {
    it('should persist all commits', async function () {
      const repo = await fake.repository();
      ctx.targetPath = repo.path;

      const urlProvider = new GitHubUrlProvider(repo);
      urlProvider.configure({ url: 'https://test.com', project: 'testProject' });

      //setup DB
      await db.ensureDatabase('test');
      await db.truncate();
      await Commit.ensureCollection();
      await File.ensureCollection();
      await Hunk.ensureCollection();
      await Language.ensureCollection();
      await LanguageFileConnection.ensureCollection();
      await CommitStakeholderConnection.ensureCollection();
      await Stakeholder.ensureCollection();

      await fake.file(repo, 'test.js', testFile);
      await helpers.commit(repo, ['test.js'], bob, 'Commit1');
      await fake.file(repo, 'test.js', testFileChanged);
      await helpers.commit(repo, ['test.js'], bob, 'Commit2');
      await fake.file(repo, 'test.js', testFileChangedAgain);
      await helpers.commit(repo, ['test.js'], bob, 'Commit3');
      const commits = await repo.listAllCommits();

      for (const commit of commits) {
        await Commit.persist(repo, commit, urlProvider);
      }

      const dbCommitsCollectionData = await (await db.query('FOR i IN @@collection RETURN i', { '@collection': 'commits' })).all();

      expect(dbCommitsCollectionData.length).to.equal(3);
      expect(dbCommitsCollectionData[0].message).to.equal('Commit1\n');
      expect(dbCommitsCollectionData[1].message).to.equal('Commit2\n');
      expect(dbCommitsCollectionData[2].message).to.equal('Commit3\n');
    });
  });

  describe('#processTree', function () {
    it('should persist all commits and process tree to generate hunks', async function () {
      const repo = await fake.repository();
      ctx.targetPath = repo.path;

      const urlProvider = new GitHubUrlProvider(repo);
      urlProvider.configure({ url: 'https://test.com', project: 'testProject' });

      //setup DB
      await db.ensureDatabase('test');
      await db.truncate();
      await Commit.ensureCollection();
      await File.ensureCollection();
      await Hunk.ensureCollection();
      await Language.ensureCollection();
      await LanguageFileConnection.ensureCollection();

      await fake.file(repo, 'test.js', testFile);
      await helpers.commit(repo, ['test.js'], bob, 'Commit1');
      await fake.file(repo, 'test.js', testFileChanged);
      await helpers.commit(repo, ['test.js'], bob, 'Commit2');
      await fake.file(repo, 'test.js', testFileChangedAgain);
      await helpers.commit(repo, ['test.js'], bob, 'Commit3');

      const currentBranch = await repo.getCurrentBranch();

      const commits = await repo.listAllCommits();

      for (const commit of commits) {
        const commitDAO = await Commit.persist(repo, commit, urlProvider);
        await Promise.all(await commitDAO.processTree(repo, commit, currentBranch, urlProvider, gateway));
      }
      const dbCommitsCollectionData = await (await db.query('FOR i IN @@collection RETURN i', { '@collection': 'commits' })).all();
      const dbFilesCollectionData = await (await db.query('FOR i IN @@collection RETURN i', { '@collection': 'files' })).all();
      const dbHunksCollectionData = await (await db.query('FOR i IN @@collection RETURN i', { '@collection': 'commits-files' })).all();

      expect(dbCommitsCollectionData.length).to.equal(3);
      expect(dbCommitsCollectionData[0].stats.additions).to.equal(3);
      expect(dbCommitsCollectionData[0].stats.deletions).to.equal(0);
      expect(dbCommitsCollectionData[1].stats.additions).to.equal(1);
      expect(dbCommitsCollectionData[1].stats.deletions).to.equal(1);
      expect(dbCommitsCollectionData[2].stats.additions).to.equal(3);
      expect(dbCommitsCollectionData[2].stats.deletions).to.equal(0);

      expect(dbFilesCollectionData.length).to.equal(1);
      expect(dbFilesCollectionData[0].path).to.equal('test.js');

      expect(dbHunksCollectionData.length).to.equal(3);
      expect(dbHunksCollectionData[0].stats.additions).to.equal(3);
      expect(dbHunksCollectionData[0].stats.deletions).to.equal(0);
      expect(dbHunksCollectionData[0].hunks.length).to.equal(1);
      expect(dbHunksCollectionData[0].hunks[0].newLines).to.equal(3);
      expect(dbHunksCollectionData[0].hunks[0].newStart).to.equal(1);
      expect(dbHunksCollectionData[0].hunks[0].oldLines).to.equal(0);
      expect(dbHunksCollectionData[0].hunks[0].oldStart).to.equal(0);

      expect(dbHunksCollectionData[1].stats.additions).to.equal(1);
      expect(dbHunksCollectionData[1].stats.deletions).to.equal(1);
      expect(dbHunksCollectionData[1].hunks.length).to.equal(1);
      expect(dbHunksCollectionData[1].hunks[0].newLines).to.equal(1);
      expect(dbHunksCollectionData[1].hunks[0].newStart).to.equal(2);
      expect(dbHunksCollectionData[1].hunks[0].oldLines).to.equal(1);
      expect(dbHunksCollectionData[1].hunks[0].oldStart).to.equal(2);

      expect(dbHunksCollectionData[2].stats.additions).to.equal(3);
      expect(dbHunksCollectionData[2].stats.deletions).to.equal(0);
      expect(dbHunksCollectionData[2].hunks.length).to.equal(2);
      expect(dbHunksCollectionData[2].hunks[0].newLines).to.equal(1);
      expect(dbHunksCollectionData[2].hunks[0].newStart).to.equal(2);
      expect(dbHunksCollectionData[2].hunks[0].oldLines).to.equal(0);
      expect(dbHunksCollectionData[2].hunks[0].oldStart).to.equal(1);
      expect(dbHunksCollectionData[2].hunks[1].newLines).to.equal(2);
      expect(dbHunksCollectionData[2].hunks[1].newStart).to.equal(4);
      expect(dbHunksCollectionData[2].hunks[1].oldLines).to.equal(0);
      expect(dbHunksCollectionData[2].hunks[1].oldStart).to.equal(2);
    });
  });
});
