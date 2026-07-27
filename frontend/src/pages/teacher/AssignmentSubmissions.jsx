import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Typography, Tag, Space, Modal, DatePicker, message } from 'antd';
import {
  ArrowLeftOutlined, EyeOutlined, ReloadOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { assignmentsApi } from '../../api';
import { formatDateTime, formatDate } from '../../utils/format';

export default function AssignmentSubmissions() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [roster, setRoster] = useState({ submitted: [], not_submitted: [] });
  const [loading, setLoading] = useState(true);

  // Deadline-extension modal state.
  const [selected, setSelected] = useState([]); // student ids ticked in the missing table
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIds, setModalIds] = useState([]); // students the open modal will extend
  const [newDeadline, setNewDeadline] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    assignmentsApi
      .roster(id)
      .then((r) => { setRoster(r); setSelected([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  const openExtend = (ids) => {
    if (!ids.length) return;
    setModalIds(ids);
    setNewDeadline(null);
    setModalOpen(true);
  };

  const submitExtend = async () => {
    if (!newDeadline) return message.error(t('teacher.pickDeadline'));
    setSaving(true);
    try {
      // A deadline is set in whole days; store it as the end of the chosen day so
      // the student has the whole day to submit — mirrors how assignments are made.
      await assignmentsApi.extendDeadline(id, {
        student_ids: modalIds,
        deadline: newDeadline.endOf('day').toISOString(),
      });
      message.success(t('teacher.extendSuccess'));
      setModalOpen(false);
      load();
    } catch (e) {
      message.error(e.response?.data?.message || t('teacher.extendError'));
    } finally {
      setSaving(false);
    }
  };

  const submittedColumns = [
    { title: t('common.student'), dataIndex: 'student_name' },
    {
      // The row is the student's best attempt — that is their grade. The other
      // tries are listed beside it so a teacher can still open them.
      title: t('common.score'), dataIndex: 'final_score', width: 140,
      render: (v) => (v === null || v === undefined
        ? <Tag color="processing">{t('common.analyzing')}</Tag>
        : <Tag color={v >= 70 ? 'green' : v >= 50 ? 'orange' : 'red'}>{Math.round(v)}/100</Tag>),
    },
    {
      title: t('student.attempt'), dataIndex: 'attempts', width: 200,
      render: (list, r) => (
        <Space size={4} wrap>
          {(list || []).map((a) => (
            <Tag
              key={a.id}
              color={a.is_best ? 'green' : 'default'}
              style={{ cursor: 'pointer', margin: 0 }}
              onClick={() => navigate(`/teacher/submissions/${a.id}`)}
            >
              {t('student.attemptShort', { n: a.attempt || 1 })}
              {a.score === null || a.score === undefined ? ' · …' : ` · ${Math.round(a.score)}`}
            </Tag>
          ))}
          {(r.attempts_used ?? 1) < (r.max_attempts ?? 1) && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {t('student.attemptsLeftShort', { left: (r.max_attempts ?? 1) - (r.attempts_used ?? 1) })}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      // The copied work has to be visible without opening every submission,
      // otherwise a teacher only finds it by chance.
      title: t('plagiarism.column'), dataIndex: 'plagiarism_score', width: 150,
      render: (v, r) => {
        if (v === null || v === undefined) return <Tag>—</Tag>;
        const status = r.plagiarism_status;
        const color = status === 'high' || status === 'duplicate' ? 'red'
          : status === 'moderate' ? 'orange'
          : status === 'low' ? 'blue' : 'green';
        return <Tag color={color}>{Math.round(v)}% · {t(`plagiarism.status.${status || 'clean'}`)}</Tag>;
      },
    },
    { title: t('student.submitted'), dataIndex: 'submitted_at', width: 180, render: (v) => formatDateTime(v, '-') },
    { title: '', width: 120, render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/teacher/submissions/${r.id}`)}>{t('common.open')}</Button> },
  ];

  const missingColumns = [
    { title: t('common.student'), dataIndex: 'student_name' },
    {
      title: t('teacher.newDeadline'), dataIndex: 'new_deadline', width: 220,
      render: (v, r) => {
        if (!v) return <Tag>{t('teacher.noExtension')}</Tag>;
        return r.extension_expired
          ? <Tag color="red">{t('teacher.extensionExpired')}</Tag>
          : <Tag color="blue">{t('teacher.reopenedUntil', { date: formatDate(v) })}</Tag>;
      },
    },
    {
      title: '', width: 160,
      render: (_, r) => (
        <Button size="small" icon={<ClockCircleOutlined />} onClick={() => openExtend([r.student_id])}>
          {r.new_deadline ? t('teacher.changeDeadline') : t('teacher.extendDeadline')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/teacher/assignments')}>{t('common.back')}</Button>
          <Typography.Title level={3} style={{ margin: 0 }}>{t('teacher.submissionsFor')}</Typography.Title>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={load}>{t('common.refresh')}</Button>
      </Space>

      {/* Who submitted */}
      <Typography.Title level={5} style={{ marginTop: 8 }}>
        {t('teacher.submittedHeading')} ({roster.submitted.length})
      </Typography.Title>
      <Table
        rowKey="id"
        columns={submittedColumns}
        dataSource={roster.submitted}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={false}
      />

      {/* Who didn't submit — with the deadline-extension flow */}
      <Space style={{ marginTop: 28, marginBottom: 8, justifyContent: 'space-between', width: '100%' }} align="center">
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('teacher.notSubmittedHeading')} ({roster.not_submitted.length})
        </Typography.Title>
        <Button
          type="primary"
          icon={<ClockCircleOutlined />}
          disabled={!selected.length}
          onClick={() => openExtend(selected)}
        >
          {t('teacher.extendSelected', { count: selected.length })}
        </Button>
      </Space>
      <Table
        rowKey="student_id"
        columns={missingColumns}
        dataSource={roster.not_submitted}
        loading={loading}
        scroll={{ x: 600 }}
        pagination={false}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
        locale={{ emptyText: t('teacher.notSubmittedEmpty') }}
      />

      <Modal
        title={t('teacher.extendFor', { count: modalIds.length })}
        open={modalOpen}
        onOk={submitExtend}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Typography.Paragraph type="secondary">{t('teacher.extendHint')}</Typography.Paragraph>
        <DatePicker
          style={{ width: '100%' }}
          format="DD.MM.YYYY"
          placeholder={t('teacher.pickDeadline')}
          value={newDeadline}
          onChange={setNewDeadline}
          disabledDate={(d) => d && d < dayjs().startOf('day')}
        />
      </Modal>
    </div>
  );
}
