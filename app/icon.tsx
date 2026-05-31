import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          borderRadius: '20%',
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            background: '#3A14FF',
            borderRadius: '50%',
            filter: 'blur(2px)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
