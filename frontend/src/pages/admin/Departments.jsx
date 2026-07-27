import { useEffect, useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';

export default function AdminDepartments() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => { setLoading(true); adminApi.departments().then(setData).finally(() => setLoading(false)); };
  useEffect(load, []);

  const create = async (values) => {
    try { await adminApi.createDepartment(values); message.success(t('common.created')); setOpen(false); form.resetFields(); load(); }
    catch { message.error(t('common.error')); }
  };

  const columns = [
    { title: t('common.name'), dataIndex: 'name' },
    { title: t('common.description'), dataIndex: 'description', render: (v) => v || '-' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ApartmentOutlined /> {t('admin.departmentsTitle')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('common.add')}</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} />
      <Modal
        title={t('admin.newDepartment')}
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
          <Form.Item name="description" label={t('common.description')}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
