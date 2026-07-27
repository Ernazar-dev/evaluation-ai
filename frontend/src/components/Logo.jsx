import logoMark from '../images/logo-mark.png';
import logoFull from '../images/logo-full.png';

// Single source of truth for the platform brand. The name lives here rather
// than in the locale files: it is a proper noun, so it stays identical in every
// language.
export const APP_NAME = 'Independent Work Evaluation-AI';

// The same name broken where it reads best when it has to stack — the sider
// brand block sets it as two lines beside the shield.
export const APP_NAME_LINES = ['Independent Work', 'Evaluation-AI'];

// Shield only — for tight spots (sider header, favicon-sized slots). The source
// artwork has a white background, so it sits on a white plate to stay readable
// on the dark sider.
export function LogoMark({ size = 36, radius = 10, style }) {
  return (
    <img
      src={logoMark}
      alt={APP_NAME}
      width={size}
      height={size}
      style={{
        flex: `0 0 ${size}px`,
        borderRadius: radius,
        background: '#fff',
        objectFit: 'cover',
        display: 'block',
        ...style,
      }}
    />
  );
}

// Full lockup (shield + IWE-AI + wordmark) — for the login card and anywhere
// else with room to breathe.
export function LogoFull({ width = 200, style }) {
  return (
    <img
      src={logoFull}
      alt={APP_NAME}
      style={{ width, maxWidth: '100%', height: 'auto', display: 'block', ...style }}
    />
  );
}
