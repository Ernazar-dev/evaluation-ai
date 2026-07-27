import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Button } from 'antd';
import {
  FileTextOutlined, FileDoneOutlined, ClockCircleOutlined, TrophyOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subjectsApi, assignmentsApi } from '../../api';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../store/auth';
import { formatWindow } from '../../utils/format';

export default function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [ratings, setRatings] = useState([]);

  useEffect(() => {
    assignmentsApi.list().then(setAssignments).catch(() => {});
    assignmentsApi.mySubmissions().then(setSubs).catch(() => {});
    subjectsApi.ratings().then(setRatings).catch(() => {});
  }, []);

  // Still actionable = tries left, not just "never submitted". A student with a
  // weak first attempt and two tries in hand still has work to do here.
  const active = assignments.filter((a) => !a.is_expired && (a.attempts_left ?? 1) > 0);
  const waiting = subs.filter((s) => !s.is_graded);
  // One score per assignment — the attempt that counts — so retrying a task
  // cannot drag a student's own average down.
  const graded = subs.filter((s) => s.is_graded && s.is_best !== false);
  const avgScore = graded.length
    ? Math.round(graded.reduce((a, b) => a + (b.final_score ?? b.overall_score ?? 0), 0) / graded.length)
    : 0;

  return (
    <div>
      <Typography.Title level={3}>
        {t('student.greeting', { name: user?.full_name || user?.username })}
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard title={t('student.statActive')} value={active.length} prefix={<FileTextOutlined />} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title={t('student.statSubmitted')} value={subs.length} prefix={<FileDoneOutlined />} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title={t('student.statWaiting')} value={waiting.length} prefix={<ClockCircleOutlined />} color="#faad14" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title={t('student.avgScore')} value={avgScore} suffix="/100" prefix={<TrophyOutlined />} color="#52c41a" />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={t('student.availableTop')}
            extra={<a onClick={() => navigate('/student/assignments')}>{t('common.all')}</a>}
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={active.slice(0, 5)}
              locale={{ emptyText: t('student.noAssignments') }}
              columns={[
                { title: t('common.title'), dataIndex: 'title', ellipsis: true },
                {
                  title: t('student.deadline'),
                  dataIndex: 'deadline',
                  width: 190,
                  render: (_, r) => formatWindow(r.start_at, r.deadline),
                },
                {
                  title: t('student.action'),
                  width: 120,
                  render: (_, r) => (
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => navigate(`/student/submit/${r.id}`)}
                    >
                      {t('student.submit')}
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={`${t('student.yourResults')} (${subs.length})`}
            extra={<a onClick={() => navigate('/student/submissions')}>{t('common.all')}</a>}
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={subs.slice(0, 5)}
              locale={{ emptyText: t('student.noWork') }}
              columns={[
                { title: t('common.title'), dataIndex: 'assignment_title', ellipsis: true },
                {
                  title: t('common.score'),
                  width: 90,
                  render: (_, r) =>
                    r.is_graded ? (
                      <Tag color={r.overall_score >= 50 ? 'green' : 'orange'}>{Math.round(r.overall_score)}</Tag>
                    ) : (
                      <Tag color="processing">{t('common.analyzing')}</Tag>
                    ),
                },
                {
                  title: t('student.details'),
                  width: 90,
                  render: (_, r) => (
                    <Button type="link" size="small" onClick={() => navigate(`/student/submissions/${r.id}`)}>
                      {t('common.open')}
                    </Button>
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
