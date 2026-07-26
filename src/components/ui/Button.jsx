import React from 'react'

const Button = ({buttonContent,btnUsageFunc}) => {
  return (
    <div className='w-full flex justify-center mt-4'>
       <button className='bg-blue-600 text-white py-2 px-4 rounded-2xl' onClick={btnUsageFunc}>
          {buttonContent}
      </button>
    </div>
  )
}

export default Button