import { useEffect, useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Avatar, Breadcrumb, Select, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, UserOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';

const { Title, Text } = Typography;

/**
 * Three-level drill-down mirroring the reference platform:
 * teachers → that teacher's groups → that group's students.
 */
export default function AdminTeachers() {
  const { t } = useTranslation();
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTeachers = () => {
    setLoading(true);
    adminApi.teachers().then(setTeachers).finally(() => setLoading(false));
  };
  useEffect(loadTeachers, []);

  // Refresh the group lists for the teacher currently open.
  const refreshGroups = async (tch) => {
    const all = await adminApi.groups();
    setAllGroups(all);
    setGroups(all.filter((g) => g.teacher_id === tch.id));
  };

  const openTeacher = async (tch) => {
    setLoading(true);
    setTeacher(tch);
    setGroup(null);
    await refreshGroups(tch);
    setLoading(false);
  };

  // Assign a free group to this teacher (Group.teacherId → teacher.id).
  const assignGroup = async (groupId) => {
    if (!groupId) return;
    try {
      await adminApi.updateGroup(groupId, { teacher_id: teacher.id });
      message.success(t('admin.groupAssigned'));
      await refreshGroups(teacher);
    } catch (e) {
      message.error(e.response?.data?.error || t('common.error'));
    }
  };

  // Detach a group from this teacher (Group.teacherId → null).
  const unassignGroup = async (groupId) => {
    try {
      await adminApi.updateGroup(groupId, { teacher_id: null });
      message.success(t('admin.groupUnassigned'));
      await refreshGroups(teacher);
    } catch (e) {
      message.error(e.response?.data?.error || t('common.error'));
    }
  };

  // Groups not yet attached to any teacher — the only ones offered, since a
  // group belongs to a single teacher (one subject, one teacher).
  const freeGroups = allGroups.filter((g) => !g.teacher_id);

  const openGroup = async (g) => {
    setLoading(true);
    setGroup(g);
    setStudents(await adminApi.groupStudents(g.id));
    setLoading(false);
  };

  const back = () => {
    if (group) setGroup(null);
    else setTeacher(null);
  };

  const level = group ? 'students' : teacher ? 'groups' : 'teachers';

  const views = {
    teachers: {
      title: t('admin.teachersAndGroups'),
      table: (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={teachers}
          scroll={{ x: 600 }}
          columns={[
            { title: t('common.teacher'), render: (_, r) => (
              <Space>
                <Avatar icon={<UserOutlined />} style={{ background: '#0958d9' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{r.full_name || r.username}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.username}</Text>
                </div>
              </Space>
            ) },
            { title: t('common.status'), dataIndex: 'is_active', width: 130,
              render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? t('admin.online') : t('admin.offline')}</Tag> },
            { title: t('student.action'), width: 130, render: (_, r) => (
              <Button size="small" onClick={() => openTeacher(r)}>{t('nav.groups')}</Button>
            ) },
          ]}
        />
      ),
    },
    groups: {
      title: t('admin.teacherGroups'),
      table: (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              showSearch
              optionFilterProp="label"
              style={{ width: 260 }}
              placeholder={t('admin.assignGroup')}
              value={null}
              onChange={assignGroup}
              disabled={!freeGroups.length}
              notFoundContent={t('admin.noFreeGroups')}
              options={freeGroups.map((g) => ({ value: g.id, label: g.name }))}
            />
            {!freeGroups.length && <Typography.Text type="secondary">{t('admin.noFreeGroups')}</Typography.Text>}
          </Space>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={groups}
            locale={{ emptyText: t('admin.noGroupsForTeacher') }}
            columns={[
              { title: t('common.group'), dataIndex: 'name', render: (v) => (
                <Space><TeamOutlined /> <b>{v}</b></Space>
              ) },
              { title: t('admin.students'), dataIndex: 'student_count', width: 120, render: (v) => <Tag>{v}</Tag> },
              { title: t('student.action'), width: 220, render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => openGroup(r)}>{t('admin.students')}</Button>
                  <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => unassignGroup(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>{t('admin.remove')}</Button>
                  </Popconfirm>
                </Space>
              ) },
            ]}
          />
        </>
      ),
    },
    students: {
      title: t('admin.groupStudents'),
      table: (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={students}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 80 },
            { title: t('admin.nameLogin'), render: (_, r) => (
              <div>
                <div style={{ fontWeight: 600 }}>{r.full_name || r.username}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.username}</Text>
              </div>
            ) },
          ]}
        />
      ),
    },
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={3} style={{ margin: 0 }}>{views[level].title}</Title>
        <Space>
          {level !== 'teachers' && (
            <Button icon={<ArrowLeftOutlined />} onClick={back}>
              {group ? t('admin.backToGroups') : t('admin.backToTeachers')}
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadTeachers} disabled={level !== 'teachers'}>
            {t('common.refresh')}
          </Button>
        </Space>
      </Space>

      {level !== 'teachers' && (
        <Breadcrumb
          style={{ marginBottom: 12 }}
          items={[
            { title: <a onClick={() => setTeacher(null)}>{t('nav.teachers')}</a> },
            ...(teacher ? [{ title: group ? <a onClick={() => setGroup(null)}>{teacher.full_name || teacher.username}</a> : (teacher.full_name || teacher.username) }] : []),
            ...(group ? [{ title: group.name }] : []),
          ]}
        />
      )}

      <Card>{views[level].table}</Card>
    </div>
  );
}
