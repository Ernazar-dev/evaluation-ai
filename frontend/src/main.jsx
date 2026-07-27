import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import ruRU from 'antd/locale/ru_RU';
import uzUZ from 'antd/locale/uz_UZ';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/uz-latn';
import App from './App';
import './i18n';
import './index.css';

const theme = {
  token: {
    colorPrimary: '#0958d9',
    colorInfo: '#0958d9',
    colorLink: '#0958d9',
    borderRadius: 10,
    fontSize: 14,
    wireframe: false,
    colorBgLayout: '#f2f6fc',
    boxShadowTertiary: '0 1px 2px rgba(9,88,217,0.05), 0 2px 8px rgba(9,88,217,0.06)',
  },
  components: {
    Card: { paddingLG: 20, boxShadowTertiary: '0 1px 2px rgba(9,88,217,0.05), 0 4px 16px rgba(9,88,217,0.07)' },
    Button: { controlHeight: 38, fontWeight: 500 },
    Table: { headerBg: '#f4f8ff', borderColor: '#e8eef7' },
    Menu: { itemBorderRadius: 8, itemMarginInline: 8, darkItemBg: 'transparent' },
    Layout: { headerBg: '#ffffff', siderBg: '#0a2540' },
  },
};

const ANTD_LOCALES = { uz: uzUZ, ru: ruRU };
const DAYJS_LOCALES = { uz: 'uz-latn', ru: 'ru' };

// Keeps antd's built-in strings (date pickers, pagination, empty states) and
// dayjs formatting in sync with the language picked in the UI.
function LocalizedApp() {
  const { i18n } = useTranslation();
  const lng = ANTD_LOCALES[i18n.language] ? i18n.language : 'uz';
  dayjs.locale(DAYJS_LOCALES[lng]);

  return (
    <ConfigProvider theme={theme} locale={ANTD_LOCALES[lng]}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocalizedApp />
  </React.StrictMode>
);
