import { useEffect, useState } from 'react';
import { Badge, Dropdown, List, Button, Typography, Empty, Spin } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '../api';
import { useAuth } from '../store/auth';

const { Text } = Typography;

/** Header bell — students get their own feed; other roles don't have one. */
export default function NotificationBell() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    setLoading(true);
    notificationsApi
      .list()
      .then((d) => setItems(d.notifications || d || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (role === 'student') load(); }, [role]);

  if (role !== 'student') return null;

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    await notificationsApi.readAll();
    load();
  };

  const panel = (
    <div style={{ width: 340, background: '#fff', borderRadius: 10, boxShadow: '0 6px 24px rgba(9,88,217,0.16)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #eef3fa' }}>
        <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('nav.notifications')}</strong>
        {unread > 0 && (
          // Short label ("Barchasini o'qildi"), not the long admin one — the
          // panel is only 340px wide and the long text used to spill out of it.
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={markAll} style={{ flexShrink: 0, paddingInline: 0 }}>
            {t('student.readAll')}
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
      ) : items.length === 0 ? (
        <Empty style={{ padding: 20 }} image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('admin.noNotifications')} />
      ) : (
        <List
          size="small"
          style={{ maxHeight: 340, overflowY: 'auto' }}
          dataSource={items.slice(0, 8)}
          renderItem={(n) => (
            <List.Item
              style={{ padding: '10px 14px', cursor: 'pointer', background: n.is_read ? '#fff' : '#f5f9ff' }}
              onClick={async () => {
                if (!n.is_read) await notificationsApi.read(n.id).catch(() => {});
                setOpen(false);
                navigate('/student/notifications');
              }}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600 }}>{n.title}</span>}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {n.message}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) load(); }}
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={() => panel}
    >
      <Badge count={unread} size="small">
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: '#0958d9' }} />
      </Badge>
    </Dropdown>
  );
}
