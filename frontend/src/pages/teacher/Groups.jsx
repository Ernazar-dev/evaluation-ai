import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Tag, Empty, Drawer, Table, Space } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { teacherApi } from '../../api';
import Loading from '../../components/Loading';

export default function TeacherGroups() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState(null);
  // The group whose card was clicked, and its roster. They are kept apart so the
  // drawer can open at once and show its spinner while the request is in flight.
  const [selected, setSelected] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    teacherApi.groups().then((g) => setGroups(g)).catch(() => setGroups([]));
  }, []);

  const openGroup = (g) => {
    setSelected(g);
    setRoster(null);
    setRosterLoading(true);
    teacherApi
      .groupStudents(g.id)
      .then(setRoster)
      // A failed load leaves an empty roster rather than a stuck spinner.
      .catch(() => setRoster({ students: [] }))
      .finally(() => setRosterLoading(false));
  };

  const columns = [
    {
      title: t('common.student'),
      dataIndex: 'username',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.full_name || v}</div>
          {r.full_name && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: t('teacher.submittedTasks'),
      dataIndex: 'submission_count',
      width: 150,
      render: (v) => <Tag>{v ?? 0}</Tag>,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      width: 130,
      render: (v) => (
        <Tag color={v ? 'green' : 'default'}>{v ? t('teacher.active') : t('teacher.inactive')}</Tag>
      ),
    },
  ];

  if (!groups) return <Loading />;

  return (
    <div>
      <Typography.Title level={3}>{t('teacher.myGroups')}</Typography.Title>
      {groups.length === 0 ? <Empty description={t('teacher.noGroupsAssigned')} /> : (
        <Row gutter={[16, 16]}>
          {groups.map((g) => (
            <Col xs={24} sm={12} lg={8} key={g.id}>
              {/* The whole card is the target: tapping a group opens its roster. */}
              <Card hoverable onClick={() => openGroup(g)} style={{ cursor: 'pointer' }}>
                <Card.Meta
                  avatar={<TeamOutlined style={{ fontSize: 28, color: '#0958d9' }} />}
                  title={g.name}
                  description={(
                    <Space direction="vertical" size={4}>
                      <Tag>{t('teacher.studentCount', { count: g.student_count })}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t('teacher.viewStudents')}
                      </Typography.Text>
                    </Space>
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Drawer
        open={!!selected}
        onClose={() => { setSelected(null); setRoster(null); }}
        width={640}
        title={t('admin.studentsOf', { group: selected?.name || '' })}
      >
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={roster?.students || []}
          loading={rosterLoading}
          pagination={false}
          scroll={{ x: 520 }}
          locale={{ emptyText: <Empty description={t('teacher.noStudentsInGroup')} /> }}
        />
      </Drawer>
    </div>
  );
}
