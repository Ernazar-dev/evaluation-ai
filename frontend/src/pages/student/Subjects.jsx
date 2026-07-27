import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Empty, Badge } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsApi } from '../../api';
import Loading from '../../components/Loading';

export default function StudentSubjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState(null);

  useEffect(() => { subjectsApi.list().then(setSubjects).catch(() => setSubjects([])); }, []);
  if (!subjects) return <Loading />;

  return (
    <div>
      <Typography.Title level={3}>{t('nav.subjects')}</Typography.Title>
      {subjects.length === 0 && <Empty description={t('student.noSubjectsWithTasks')} />}
      <Row gutter={[16, 16]}>
        {subjects.map((s) => (
          <Col xs={24} sm={12} lg={8} key={s.id}>
            <Badge.Ribbon text={t('student.taskShort', { count: s.assignment_count })} color="blue">
              <Card hoverable onClick={() => navigate(`/student/subjects/${s.id}`)}>
                <Card.Meta avatar={<BookOutlined style={{ fontSize: 28, color: '#0958d9' }} />} title={s.name} description={s.code} />
              </Card>
            </Badge.Ribbon>
          </Col>
        ))}
      </Row>
    </div>
  );
}
