import React from 'react'

export const Logo: React.FC = () => {
  return (
    <svg
      className="graphic-logo"
      viewBox="0 0 170 32"
      height="32"
      width="170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        maxHeight: '32px',
        width: 'auto',
        overflow: 'visible',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    >
      <rect width="32" height="32" rx="8" fill="#4338CA" />
      <path
        d="M8 9H19C20.6569 9 22 10.3431 22 12C22 13.6569 20.6569 15 19 15H13V21H9V9H8Z"
        fill="white"
      />
      <circle cx="10" cy="21" r="1.5" fill="#818CF8" />
      <text
        x="42"
        y="18"
        fill="currentColor"
        fontSize="15"
        fontWeight="800"
        fontFamily="var(--font-body), system-ui, sans-serif"
      >
        پرشین‌پارت
      </text>
      <text
        x="42"
        y="28"
        fill="var(--theme-elevation-400, #94a3b8)"
        fontSize="9"
        fontWeight="500"
        fontFamily="var(--font-body), system-ui, sans-serif"
      >
        سامانه مدیریت
      </text>
    </svg>
  )
}

export default Logo
