import { Card, Statistic } from 'antd';

// Stat tile with an optional coloured icon badge + subtle hover lift.
export default function StatCard({ title, value, prefix, suffix, color = '#0958d9' }) {
  return (
    <Card bordered={false} className="shadow-sm card-hover" styles={{ body: { display: 'flex', alignItems: 'center', gap: 16 } }}>
      {prefix && (
        <div
          style={{
            width: 48,
            height: 48,
            flex: '0 0 48px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color,
            background: `${color}1a`,
          }}
        >
          {prefix}
        </div>
      )}
      <Statistic title={title} value={value} suffix={suffix} valueStyle={{ color, fontWeight: 600 }} />
    </Card>
  );
}
