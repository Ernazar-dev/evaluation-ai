import { useEffect, useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';
import { apiError } from '../../utils/format';

export default function AdminSubjects() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    adminApi.subjects().then(setData).catch((e) => message.error(apiError(e, t('common.error')))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async (values) => {
    try { await adminApi.createSubject(values); message.success(t('common.created')); setOpen(false); form.resetFields(); load(); }
    catch (e) { message.error(apiError(e, t('common.error'))); }
  };
  // A subject still attached to assignments or ratings cannot be removed; the
  // API says so, and the admin needs to see that rather than a row that quietly
  // reappears on the next load.
  const remove = async (id) => {
    try { await adminApi.deleteSubject(id); message.success(t('common.deleted')); }
    catch (e) { message.error(apiError(e, t('common.error'))); }
    load();
  };

  const columns = [
    { title: t('common.name'), dataIndex: 'name' },
    { title: t('common.code'), dataIndex: 'code' },
    { title: t('common.description'), dataIndex: 'description', render: (v) => v || '-' },
    { title: '', width: 60, render: (_, r) => <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}><DatabaseOutlined /> {t('admin.subjectsTitle')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('common.add')}</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 500 }} />
      <Modal
        title={t('admin.newSubject')}
        open={open}
        centered
        width={480}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label={t('common.code')}><Input placeholder={t('admin.codeAuto')} /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
