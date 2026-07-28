import { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { warmUp, isNetworkError } from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { LogoFull } from '../components/Logo';

// How long a login may take before we tell the user the server is waking up
// rather than leaving them looking at a silent spinner.
const WAKING_HINT_AFTER = 4000;

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [waking, setWaking] = useState(false);
  const wakingTimer = useRef(null);

  // Start the free host's cold start while the user is still typing, so the
  // login request itself meets a server that is already up.
  useEffect(() => {
    warmUp();
  }, []);

  useEffect(() => () => clearTimeout(wakingTimer.current), []);

  const onFinish = async (values) => {
    setLoading(true);
    wakingTimer.current = setTimeout(() => setWaking(true), WAKING_HINT_AFTER);
    try {
      const data = await login(values.username, values.password);
      message.success(t('auth.loginSuccess'));
      navigate(`/${data.role}`);
    } catch (e) {
      // A dropped connection is not a wrong password, and saying "sign-in
      // failed" for it sends the user off checking credentials that were fine.
      message.error(
        isNetworkError(e)
          ? t('auth.connectionError')
          : e.response?.data?.error || t('auth.loginError')
      );
    } finally {
      clearTimeout(wakingTimer.current);
      setWaking(false);
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
        {/* Shown only once the wait is long enough to look broken. It says the
            request is still alive and roughly why, which is the difference
            between waiting a few more seconds and reloading the page. */}
        {waking && (
          <Typography.Paragraph
            type="secondary"
            style={{ textAlign: 'center', fontSize: 12, margin: '12px 0 0' }}
          >
            {t('auth.waking')}
          </Typography.Paragraph>
        )}
        {/* No registration and no demo credentials: the admin creates every
            account and hands out the login/password personally. */}
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, margin: '16px 0 0' }}>
          {t('auth.adminOnlyHint')}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
