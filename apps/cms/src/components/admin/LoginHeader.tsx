import React from 'react'

export const LoginHeader: React.FC = () => {
  return (
    <div
      style={{
        textAlign: 'center',
        marginBottom: '26px',
      }}
    >
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          margin: '0 0 6px 0',
          color: 'var(--theme-elevation-900)',
          letterSpacing: '-0.02em',
        }}
      >
        ورود به پنل مدیریت
      </h1>
      <p
        style={{
          fontSize: '0.8125rem',
          color: 'var(--theme-elevation-500)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        جهت ورود به سامانه، مشخصات کاربری مدیر را وارد فرمایید
      </p>
    </div>
  )
}

export default LoginHeader
