import { useEffect, useState } from 'react';
import { Tabs, Table } from 'antd';
import { ReadOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import LiteratureList from '../../components/LiteratureList';
import { literatureApi } from '../../api';
import { formatDateTime } from '../../utils/format';

function DownloadHistory() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    literatureApi.downloads().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={rows}
      scroll={{ x: 600 }}
      columns={[
        { title: t('teacher.book'), dataIndex: 'book_title' },
        { title: t('common.student'), dataIndex: 'username', width: 240 },
        { title: t('teacher.downloadDate'), dataIndex: 'downloaded_at', width: 190,
          render: (v) => formatDateTime(v) },
      ]}
    />
  );
}

export default function TeacherLiterature() {
  const { t } = useTranslation();
  return (
    <Tabs
      items={[
        {
          key: 'books',
          label: <><ReadOutlined /> {t('nav.literature')}</>,
          children: <LiteratureList canManage />,
        },
        {
          key: 'history',
          label: <><HistoryOutlined /> {t('teacher.downloadHistory')}</>,
          children: <DownloadHistory />,
        },
      ]}
    />
  );
}
