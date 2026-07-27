import { useEffect, useState } from 'react';
import { Row, Col, Typography, Card, List, Tag, Empty } from 'antd';
import { FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assignmentsApi, teacherApi } from '../../api';
import StatCard from '../../components/StatCard';
import GroupActivityChart from '../../components/GroupActivityChart';

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    assignmentsApi.list().then(setAssignments).catch(() => {});
    teacherApi.groups().then(setGroups).catch(() => {});
    teacherApi.groupActivity().then(setActivity).catch(() => setActivity([]));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>{t('teacher.cabinet')}</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}><StatCard title={t('teacher.myAssignments')} value={assignments.length} prefix={<FileTextOutlined />} /></Col>
        <Col xs={24} sm={12}><StatCard title={t('teacher.myGroups')} value={groups.length} prefix={<TeamOutlined />} color="#2f54eb" /></Col>
      </Row>
      <GroupActivityChart data={activity} loading={activity === null} />
      <Card title={t('teacher.recentAssignments')} style={{ marginTop: 16 }} extra={<a onClick={() => navigate('/teacher/assignments')}>{t('common.all')}</a>}>
        {assignments.length ? (
          <List
            dataSource={assignments.slice(0, 6)}
            renderItem={(a) => (
              <List.Item onClick={() => navigate(`/teacher/assignments/${a.id}/submissions`)} style={{ cursor: 'pointer' }}
                extra={a.is_expired ? <Tag color="red">{t('student.expired')}</Tag> : <Tag color="green">{t('teacher.active')}</Tag>}>
                <List.Item.Meta title={a.title} description={`${a.course || t('common.general')} · ${a.group_name || t('common.noGroup')}`} />
              </List.Item>
            )}
          />
        ) : <Empty description={t('teacher.noAssignments')} />}
      </Card>
    </div>
  );
}
