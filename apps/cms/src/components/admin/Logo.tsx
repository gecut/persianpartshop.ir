import React from 'react'

export const Logo: React.FC = () => {
  return (
    <div
      className="admin-brand-logo"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(67, 56, 202, 0.25)',
          flexShrink: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 7H15C16.6569 7 18 8.34315 18 10C18 11.6569 16.6569 13 15 13H10V17H7V7H6Z"
            fill="white"
          />
          <circle cx="8" cy="17" r="1.5" fill="#818CF8" />
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
        <span
          style={{
            fontSize: '1.125rem',
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: 'var(--theme-elevation-900)',
          }}
        >
          پرشین‌پارت
        </span>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            lineHeight: 1.2,
            color: 'var(--theme-elevation-400)',
            marginTop: '2px',
          }}
        >
          سامانه یکپارچه مدیریت
        </span>
      </div>
    </div>
  )
}

export default Logo
