import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { LogoFull } from '../components/Logo';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const data = await login(values.username, values.password);
      message.success(t('auth.loginSuccess'));
      navigate(`/${data.role}`);
    } catch (e) {
      message.error(e.response?.data?.error || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'linear-gradient(160deg,#eaf2ff 0%,#dbe9ff 45%,#0958d9 100%)' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </div>
      <Card style={{ width: 400, maxWidth: '92vw', borderRadius: 16 }} className="shadow-lg page-enter" styles={{ body: { padding: 32 } }}>
        {/* The lockup already spells the platform name out, so no repeated
            title underneath it — just the tagline. */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LogoFull width={210} style={{ margin: '0 auto 4px' }} />
          <Typography.Text type="secondary">{t('auth.tagline')}</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" rules={[{ required: true, message: t('auth.enterUsername') }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder={t('auth.username')} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t('auth.enterPassword') }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder={t('auth.password')} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            {t('auth.login')}
          </Button>
        </Form>
        {/* No registration and no demo credentials: the admin creates every
            account and hands out the login/password personally. */}
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, margin: '16px 0 0' }}>
          {t('auth.adminOnlyHint')}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
