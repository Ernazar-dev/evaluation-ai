import { useEffect, useState } from 'react';
import { Card, Typography, Avatar, List, Table, Tag, Empty, Row, Col, Statistic } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usersApi } from '../../api';
import { formatWindow } from '../../utils/format';

const { Title, Text } = Typography;

export default function MyGroups() {
  const { t } = useTranslation();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.myGroup().then(setGroup).finally(() => setLoading(false));
  }, []);

  if (!loading && !group) {
    return <Card><Empty description={t('common.noGroup')} /></Card>;
  }

  return (
    <div>
      <Title level={3}>{t('student.myGroupsTitle')}</Title>

      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={54} icon={<TeamOutlined />} style={{ background: '#0958d9' }} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{group?.name}</Title>
                <Text type="secondary">{t('student.curator')}: {group?.curator || '—'}</Text>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={t('common.student')} value={group?.student_count || 0} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title={t('nav.assignments')} value={group?.assignments?.length || 0} />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title={t('common.student')} loading={loading} size="small">
            <List
              dataSource={group?.students || []}
              renderItem={(s) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={s.full_name || s.username}
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{s.username}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title={t('nav.assignments')} loading={loading} size="small">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={group?.assignments || []}
              locale={{ emptyText: t('student.noGroupAssignments') }}
              columns={[
                { title: t('common.title'), dataIndex: 'title' },
                {
                  title: t('student.deadline'),
                  dataIndex: 'deadline',
                  width: 210,
                  render: (_, r) => (
                    <span>
                      {formatWindow(r.start_at, r.deadline)}{' '}
                      {r.is_expired && <Tag color="red">{t('student.expired')}</Tag>}
                      {r.is_upcoming && <Tag>{t('student.notStarted')}</Tag>}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
