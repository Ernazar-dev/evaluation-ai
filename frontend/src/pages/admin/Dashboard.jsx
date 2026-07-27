import { useEffect, useState } from 'react';
import { Row, Col, Typography } from 'antd';
import { UserOutlined, TeamOutlined, FileTextOutlined, CheckSquareOutlined, SolutionOutlined, CrownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';
import StatCard from '../../components/StatCard';
import GroupActivityChart from '../../components/GroupActivityChart';
import Loading from '../../components/Loading';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [s, setS] = useState(null);
  const [activity, setActivity] = useState(null);
  useEffect(() => {
    adminApi.stats().then(setS).catch(() => setS({}));
    adminApi.groupActivity().then(setActivity).catch(() => setActivity([]));
  }, []);
  if (!s) return <Loading />;

  return (
    <div>
      <Typography.Title level={3}>{t('admin.panel')}</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.totalUsers')} value={s.total_users} prefix={<UserOutlined />} /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.students')} value={s.total_students} prefix={<SolutionOutlined />} color="#0958d9" /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.teachers')} value={s.total_teachers} prefix={<TeamOutlined />} color="#2f54eb" /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.admins')} value={s.total_admins} prefix={<CrownOutlined />} color="#faad14" /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.assignments')} value={s.total_assignments} prefix={<FileTextOutlined />} /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.submissions')} value={s.total_submissions} prefix={<CheckSquareOutlined />} color="#52c41a" /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.active7d')} value={s.active_users} prefix={<UserOutlined />} color="#13c2c2" /></Col>
        <Col xs={12} md={8} lg={6}><StatCard title={t('admin.activeStudents')} value={s.active_students} prefix={<SolutionOutlined />} color="#52c41a" /></Col>
      </Row>
      <GroupActivityChart data={activity} loading={activity === null} />
    </div>
  );
}
