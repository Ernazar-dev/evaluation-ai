import { useEffect, useState } from 'react';
import { Table, Typography, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';
import { formatDateTime } from '../../utils/format';

export default function AdminLogs() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminApi.logs().then(setData).finally(() => setLoading(false)); }, []);

  const columns = [
    { title: t('common.time'), dataIndex: 'created_at', width: 180, render: (v) => formatDateTime(v) },
    { title: t('common.user'), dataIndex: 'username', width: 140 },
    { title: t('admin.action'), dataIndex: 'action', width: 160, render: (v) => <Tag>{v}</Tag> },
    { title: t('admin.details'), dataIndex: 'details' },
    { title: 'IP', dataIndex: 'ip_address', width: 120, render: (v) => v || '-' },
  ];

  return (
    <div>
      <Typography.Title level={3}><HistoryOutlined /> {t('admin.logsTitle')}</Typography.Title>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }} size="small" />
    </div>
  );
}
