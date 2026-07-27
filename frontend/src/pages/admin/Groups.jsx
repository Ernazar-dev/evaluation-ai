import { useEffect, useState } from 'react';
import { Table, Button, Typography, Space, Modal, Form, Input, Select, message, Popconfirm, List, Tag, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, TeamOutlined, UserAddOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api';
import { apiError } from '../../utils/format';

export default function AdminGroups() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [manageGroup, setManageGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [available, setAvailable] = useState([]);

  const load = () => { setLoading(true); adminApi.groups().then(setData).finally(() => setLoading(false)); };
  useEffect(() => { load(); adminApi.teachers().then(setTeachers).catch(() => {}); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (g) => { setEditing(g); form.setFieldsValue({ name: g.name, teacher_id: g.teacher_id ?? undefined }); setOpen(true); };

  const submit = async (values) => {
    try {
      if (editing) { await adminApi.updateGroup(editing.id, values); message.success(t('common.updated')); }
      else { await adminApi.createGroup(values); message.success(t('common.created')); }
      setOpen(false); setEditing(null); form.resetFields(); load();
    } catch (e) { message.error(e.response?.data?.error || t('common.error')); }
  };
  const remove = async (id) => {
    try { await adminApi.deleteGroup(id); message.success(t('common.deleted')); }
    catch (e) { message.error(apiError(e, t('common.error'))); }
    load();
  };

  const openManage = async (g) => {
    setManageGroup(g);
    setMembers(await adminApi.groupStudents(g.id));
    setAvailable(await adminApi.availableStudents());
  };
  const addStudent = async (sid) => {
    await adminApi.addGroupStudent(manageGroup.id, { student_id: sid });
    setMembers(await adminApi.groupStudents(manageGroup.id));
    setAvailable(await adminApi.availableStudents());
    load();
  };
  const removeStudent = async (sid) => {
    await adminApi.removeGroupStudent(manageGroup.id, sid);
    setMembers(await adminApi.groupStudents(manageGroup.id));
    setAvailable(await adminApi.availableStudents());
    load();
  };

  const columns = [
    { title: t('common.group'), dataIndex: 'name' },
    { title: t('common.teacher'), dataIndex: 'teacher_name', render: (v) => v || '-' },
    { title: t('admin.studentsCount'), dataIndex: 'student_count', render: (v) => <Tag>{v}</Tag> },
    {
      title: '', width: 240, render: (_, r) => (
        <Space>
          <Button size="small" icon={<UserAddOutlined />} onClick={() => openManage(r)}>{t('admin.manageStudents')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0 }}><TeamOutlined /> {t('admin.groupsTitle')}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('common.create')}</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 600 }} />

      <Modal
        title={editing ? t('common.edit') : t('admin.newGroup')}
        open={open}
        centered
        width={480}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        onCancel={() => { setOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input placeholder="CS-101" /></Form.Item>
          <Form.Item name="teacher_id" label={t('common.teacher')}><Select allowClear options={teachers.map((tr) => ({ value: tr.id, label: tr.username }))} /></Form.Item>
        </Form>
      </Modal>

      {/* Two side-by-side rosters. `Space` laid them out as inline items that
          ignored their own widths and overflowed the dialog on a laptop; a grid
          gives each half a real column and stacks them on a phone. */}
      <Modal
        title={t('admin.studentsOf', { group: manageGroup?.name || '' })}
        open={!!manageGroup}
        centered
        onCancel={() => setManageGroup(null)}
        footer={null}
        width={720}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Typography.Text strong>{t('admin.inGroup')}</Typography.Text>
            <List size="small" dataSource={members} locale={{ emptyText: t('common.empty') }}
              renderItem={(m) => (
                <List.Item actions={[<Button key="x" size="small" danger onClick={() => removeStudent(m.id)}>{t('admin.remove')}</Button>]}>
                  {m.full_name || m.username}
                </List.Item>
              )} />
          </Col>
          <Col xs={24} sm={12}>
            <Typography.Text strong>{t('admin.available')}</Typography.Text>
            <List size="small" dataSource={available} locale={{ emptyText: t('common.none') }}
              renderItem={(m) => (
                <List.Item actions={[<Button key="a" size="small" type="primary" onClick={() => addStudent(m.id)}>{t('common.add')}</Button>]}>
                  {m.full_name || m.username}
                </List.Item>
              )} />
          </Col>
        </Row>
      </Modal>
    </div>
  );
}
