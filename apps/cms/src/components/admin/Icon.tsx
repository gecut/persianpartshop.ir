import React from 'react'

export const Icon: React.FC = () => {
  return (
    <svg
      className="graphic-icon"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    >
      <rect width="24" height="24" rx="6" fill="#4338CA" />
      <path
        d="M6 7H15C16.6569 7 18 8.34315 18 10C18 11.6569 16.6569 13 15 13H10V17H7V7H6Z"
        fill="white"
      />
      <circle cx="8" cy="17" r="1.2" fill="#818CF8" />
    </svg>
  )
}

export default Icon
