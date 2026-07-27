import { useEffect, useState } from 'react';
import { Table, Typography, Tag, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { teacherApi } from '../../api';
import { formatDateTime } from '../../utils/format';

const ACTION_COLORS = {
  SUBMISSION: 'blue',
  LOGIN: 'green',
  LOGOUT: 'default',
  REGISTER: 'purple',
};

export default function TeacherActivity() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    teacherApi.activity().then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const columns = [
    { title: t('common.student'), dataIndex: 'username', width: 220 },
    { title: t('admin.action'), dataIndex: 'action', width: 160,
      render: (v) => <Tag color={ACTION_COLORS[v] || 'default'}>{v}</Tag> },
    { title: t('admin.details'), dataIndex: 'details' },
    { title: t('common.time'), dataIndex: 'created_at', width: 180,
      render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t('teacher.studentActivity')}</Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load}>{t('common.refresh')}</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 800 }} />
    </div>
  );
}
