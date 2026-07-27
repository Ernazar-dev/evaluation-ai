import { useEffect, useState } from 'react';
import { Table, Typography, Tag, Button, Space, message } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';
import { formatDateTime } from '../../utils/format';

export default function AdminNotifications() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.notifications().then(setRows).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const readAll = async () => {
    await adminApi.readAllNotifications();
    message.success(t('common.saved'));
    load();
  };

  const columns = [
    { title: t('common.title'), dataIndex: 'title', render: (v, r) => (
      <div>
        <div style={{ fontWeight: r.is_read ? 400 : 600 }}>{v}</div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.message}</Typography.Text>
      </div>
    ) },
    { title: t('admin.recipient'), dataIndex: 'recipient', width: 200 },
    { title: t('common.status'), dataIndex: 'is_read', width: 130,
      render: (v) => <Tag color={v ? 'default' : 'blue'}>{v ? '✓' : '●'}</Tag> },
    { title: t('common.time'), dataIndex: 'created_at', width: 180,
      render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0, minWidth: 0, wordBreak: 'break-word' }}>{t('admin.notificationsTitle')}</Typography.Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={load}>{t('common.refresh')}</Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={readAll} style={{ whiteSpace: 'normal', height: 'auto' }}>{t('admin.markAllRead')}</Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 800 }}
        locale={{ emptyText: t('admin.noNotifications') }}
      />
    </div>
  );
}
