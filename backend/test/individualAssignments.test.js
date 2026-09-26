import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import prisma from '../src/lib/prisma.js';
import router from '../src/routes/assignments.js';
import { recipientFilter } from '../src/utils/assignmentAccess.js';

const teacher = { id: 1, role: 'teacher', username: 'teacher' };
const student = { id: 10, role: 'student', groupId: 2, username: 'student' };
const assignment = { id: 7, teacherId: 1, groupId: 2, studentId: 10, title: 'Individual' };

async function request(method, path, user, body = {}) {
  const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route;
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await route.stack.at(-1).handle({ user, body, params: { id: '7' }, t: (key) => key }, res, (err) => { throw err; });
  return res;
}

test('individual assignment creation, validation, access and roster', async (t) => {
  mock.method(fs, 'appendFile', (...args) => args.at(-1)?.(null));
  const restores = [];
  const stub = (model, method, implementation) => {
    const original = model[method];
    const replacement = mock.fn(implementation);
    model[method] = replacement;
    restores.push(() => { model[method] = original; });
    return replacement;
  };
  t.after(() => { restores.forEach((restore) => restore()); mock.restoreAll(); });
  stub(prisma.group, 'findMany', async () => [{ id: 2 }]);
  stub(prisma.user, 'findFirst', async ({ where }) => where.id === 10 && where.groupId === 2 ? student : null);
  stub(prisma.user, 'findMany', async ({ where }) => where.id === 10 ? [student] : [student, { ...student, id: 11 }]);
  const create = stub(prisma.assignment, 'create', async ({ data }) => ({ ...assignment, ...data }));
  const notify = stub(prisma.notification, 'createMany', async () => ({}));
  stub(prisma.assignment, 'findUnique', async () => assignment);
  stub(prisma.submission, 'findMany', async () => []);
  stub(prisma.deadlineExtension, 'findMany', async () => []);

  await t.test('only the selected student is notified', async () => {
    const result = await request('post', '/', teacher, { title: 'Individual', group_ids: [2], student_id: 10 });
    assert.equal(result.statusCode, 201);
    assert.equal(create.mock.calls.at(-1).arguments[0].data.studentId, 10);
    assert.deepEqual(notify.mock.calls.at(-1).arguments[0].data.map((row) => row.studentId), [10]);
  });
  await t.test('students outside the group and malformed recipients are rejected', async () => {
    for (const student_id of [999, '', 'invalid', 0]) {
      const result = await request('post', '/', teacher, { title: 'Individual', group_ids: [2], student_id });
      assert.equal(result.statusCode, 400);
    }
    assert.equal(create.mock.calls.length, 1);
  });
  await t.test('omitting the student keeps group assignments and notifications', async () => {
    const result = await request('post', '/', teacher, { title: 'Group', group_ids: [2] });
    assert.equal(result.statusCode, 201);
    assert.equal(create.mock.calls.at(-1).arguments[0].data.studentId, null);
    assert.deepEqual(notify.mock.calls.at(-1).arguments[0].data.map((row) => row.studentId), [10, 11]);
  });
  await t.test('another student cannot open the detail, rubric or submit', async () => {
    for (const [method, path] of [['get', '/:id(\\d+)'], ['get', '/:id(\\d+)/criteria'], ['post', '/:id(\\d+)/submit']]) {
      assert.equal((await request(method, path, { ...student, id: 11 })).statusCode, 403);
    }
    assert.equal((await request('get', '/:id(\\d+)', student)).statusCode, 200);
  });
  await t.test('the missing-submissions roster contains only the recipient', async () => {
    const result = await request('get', '/:id(\\d+)/roster', teacher);
    assert.deepEqual(result.body.not_submitted.map((row) => row.student_id), [10]);
  });
  await t.test('group changes cannot broaden an individual assignment', async () => {
    assert.equal((await request('put', '/:id(\\d+)', teacher, { group_id: null })).statusCode, 400);
  });
  await t.test('student queries include group assignments and their own individual assignments', () => {
    assert.deepEqual(recipientFilter(10), { OR: [{ studentId: null }, { studentId: 10 }] });
  });
});
