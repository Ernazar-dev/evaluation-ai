import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { usersApi } from '../api';
import { apiError, formatUzPhone, UZ_PHONE_RE } from '../utils/format';

export default function Profile() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi.profile().then((p) => form.setFieldsValue(p)).catch(() => {});
  }, [form]);

  const saveProfile = async (values) => {
    setLoading(true);
    try {
      await usersApi.updateProfile(values);
      message.success(t('profile.saved'));
    } catch { message.error(t('common.error')); } finally { setLoading(false); }
  };

  const savePassword = async (values) => {
    try {
      await usersApi.changePassword(values);
      message.success(t('profile.passwordChanged'));
      pwdForm.resetFields();
    } catch (e) { message.error(apiError(e, t('common.error'))); }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Card title={t('profile.title')}>
        <Form form={form} layout="vertical" onFinish={saveProfile}>
          <Form.Item name="username" label={t('auth.username')}><Input disabled /></Form.Item>
          <Form.Item name="full_name" label={t('auth.fullName')}><Input /></Form.Item>
          <Form.Item
            name="phone"
            label={t('admin.phoneField')}
            getValueFromEvent={(e) => formatUzPhone(e.target.value)}
            rules={[{ validator: (_, v) => (!v || UZ_PHONE_RE.test(v) ? Promise.resolve() : Promise.reject(new Error(t('admin.phoneInvalid')))) }]}
          >
            <Input placeholder="+998 90 123-45-67" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>{t('common.save')}</Button>
        </Form>
        <Divider />
        <Typography.Title level={5}>{t('profile.changePassword')}</Typography.Title>
        <Form form={pwdForm} layout="vertical" onFinish={savePassword}>
          <Form.Item name="old_password" label={t('profile.currentPassword')} rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="new_password" label={t('profile.newPassword')} rules={[{ required: true, min: 4 }]}><Input.Password /></Form.Item>
          <Button htmlType="submit">{t('profile.changeBtn')}</Button>
        </Form>
      </Card>
    </div>
  );
}
