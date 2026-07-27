import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Tag, Empty } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { teacherApi } from '../../api';
import Loading from '../../components/Loading';

export default function TeacherGroups() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    teacherApi.groups().then((g) => setGroups(g)).catch(() => setGroups([]));
  }, []);

  if (!groups) return <Loading />;

  return (
    <div>
      <Typography.Title level={3}>{t('teacher.myGroups')}</Typography.Title>
      {groups.length === 0 ? <Empty description={t('teacher.noGroupsAssigned')} /> : (
        <Row gutter={[16, 16]}>
          {groups.map((g) => (
            <Col xs={24} sm={12} lg={8} key={g.id}>
              <Card><Card.Meta avatar={<TeamOutlined style={{ fontSize: 28, color: '#0958d9' }} />} title={g.name} description={<Tag>{t('teacher.studentCount', { count: g.student_count })}</Tag>} /></Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
