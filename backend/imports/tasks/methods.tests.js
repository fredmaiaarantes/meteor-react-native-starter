import { Random } from 'meteor/random'
import { TasksCollection } from './TasksCollection'
import { restoreCollections, stubCollection } from '../../tests/stubCollection'
import {
  checkTask,
  getMyTasks,
  insertTask,
  removeTask
} from './methods'
import '/imports/startup/server/tasks'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { NotSignedInError } from '../errors/NotSignedInError'

describe('tasks.methods', function () {
  let userId
  let env

  chai.use(chaiAsPromised);
  let expect = chai.expect;

  before(function () {
    stubCollection(TasksCollection)
  })
  after(function () {
    restoreCollections()
  })
  beforeEach(function () {
    TasksCollection.remove({})
    userId = Random.id()
    env = { userId }
  })

  const createTaskDoc = async ({
                                 text = Random.id(),
                                 checked = false,
                                 createdAt = new Date(),
                                 userId
                               }) => {
    const taskId = await TasksCollection.insertAsync({text, userId, checked, createdAt})
    return await TasksCollection.findOneAsync({_id: taskId})
  }

  const throwsWithoutUser = (fn) => it('throws if user is not in this-scope', () => {
    const thrown = expect(fn()).to.eventually.throw(NotSignedInError.NAME)
    thrown.with.property('reason', NotSignedInError.REASON)
    thrown.with.deep.property('details', { userId: undefined })
  })

  describe(checkTask.name, async function () {
    throwsWithoutUser(() => checkTask.call({}, {_id: null, checked: true}))
    it('updates the checked status for a task', async () => {
      const taskDoc = await createTaskDoc({userId})
      expect(taskDoc.checked).to.equal(false)

      const {_id} = taskDoc
      checkTask.call(env, {_id, checked: true})

      const updatedDoc = await TasksCollection.findOneAsync({_id})
      expect(updatedDoc.checked).to.equal(true)
    })
  })
  describe(getMyTasks.name, function () {
    throwsWithoutUser(() => getMyTasks.call(env).fetchAsync())
    it('returns all tasks by a given user, if any exist', async () => {
      expect(getMyTasks.call(env).fetchAsync()).to.eventually.deep.equal([])

      // add some tasks
      const allTasks = await Promise.all(new Array(10)
        .fill(1)
        .map(async () => await createTaskDoc({userId})))

      expect(getMyTasks.call(env).fetchAsync()).to.eventually.deep.equal(allTasks)
    })
  })
  describe(insertTask.name, function () {
    throwsWithoutUser(() => insertTask.call({}, { text: '' }))
    it('inserts a new task doc', async () => {
      const text = Random.id()
      const taskId = insertTask.call(env, {text})
      const taskDoc = await TasksCollection.findOneAsync(taskId)
      expect(taskDoc.userId).to.equal(userId)
      expect(taskDoc.checked).to.equal(false)
      expect(taskDoc.createdAt).to.be.instanceof(Date)
      expect(taskDoc.text).to.equal(text)
    })
  })
  describe(removeTask.name, function () {
    throwsWithoutUser(() => removeTask.call({}, { _id: null }))
    it('removes a task doc', async () => {
      const taskDoc = await createTaskDoc({userId})
      expect(await TasksCollection.find().countAsync()).to.equal(1)

      expect(removeTask.call(env, {_id: Random.id()})).to.eventually.equal(0)
      expect(removeTask.call(env, {_id: taskDoc._id})).to.eventually.equal(1)

      expect(await TasksCollection.find().countAsync()).to.equal(0)
    })
  })
})
