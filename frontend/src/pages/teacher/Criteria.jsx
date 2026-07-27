import { useEffect, useState } from 'react';
import {
  Table, Button, Typography, Space, Modal, Form, Input, InputNumber, message, Popconfirm, Tag, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { teacherApi } from '../../api';

// A teacher's reusable rubric library. Rows here are picked from when creating
// an assignment; editing one never touches assignments already created.
export default function TeacherCriteria() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    teacherApi.criteria()
      .then(setRows)
      .catch(() => message.error(t('teacher.criteriaLibraryLoadError')))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ weight: 10, max_score: 100 });
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({ name: r.name, description: r.description, weight: r.weight, max_score: r.max_score });
    setOpen(true);
  };

  const save = async () => {
    let values;
    try { values = await form.validateFields(); }
    catch { return; }
    setSaving(true);
    try {
      if (editing) await teacherApi.updateCriterion(editing.id, values);
      else await teacherApi.createCriterion(values);
      message.success(t('teacher.criteriaSaved'));
      setOpen(false);
      load();
    } catch (e) {
      message.error(e.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await teacherApi.deleteCriterion(id);
      message.success(t('teacher.criteriaDeleted'));
      load();
    } catch (e) { message.error(e.response?.data?.message || t('common.error')); }
  };

  const loadStandard = async () => {
    try {
      const all = await teacherApi.loadStandardCriteria();
      setRows(all);
      message.success(t('teacher.criteriaLoadedStandard'));
    } catch (e) { message.error(e.response?.data?.message || t('common.error')); }
  };

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          {r.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Typography.Text>
          )}
        </div>
      ),
    },
    { title: t('common.weight'), dataIndex: 'weight', width: 110, align: 'right', render: (v) => <Tag color="blue">{v}%</Tag> },
    {
      title: '', width: 110, render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => remove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <CheckSquareOutlined /> {t('teacher.criteriaLibraryTitle')}
        </Typography.Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadStandard}>{t('teacher.criteriaUseStandard')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('teacher.criteriaAdd')}</Button>
        </Space>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('teacher.criteriaLibraryIntro')}
      </Typography.Paragraph>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        locale={{ emptyText: <Empty description={t('teacher.criteriaLibraryEmpty')} /> }}
      />

      <Modal
        title={editing ? t('teacher.criteriaEdit') : t('teacher.criteriaNew')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        confirmLoading={saving}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        centered
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('teacher.criteriaName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} placeholder={t('teacher.criteriaDescPlaceholder')} />
          </Form.Item>
          <Form.Item name="weight" label={t('common.weight')} extra={t('teacher.criteriaWeightNote')}>
            <InputNumber min={1} max={100} addonAfter="%" style={{ width: 160 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
