import React from 'react'

export const LoginFooter: React.FC = () => {
  return (
    <div
      style={{
        marginTop: '26px',
        paddingTop: '18px',
        borderTop: '1px solid var(--theme-border-color)',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--theme-elevation-400)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
        }}
      />
      <span>سامانه امنیتی پرشین‌پارت | دسترسی مجاز کارکنان</span>
    </div>
  )
}

export default LoginFooter
