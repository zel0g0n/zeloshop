import React from 'react'

export const Storybook = () => {
  return (
    <div className='bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4 rounded-xl shadow-lg'>
      <div>Storybook Component
        <ul>
          <li className='rounded-3xl border-1 border-blue-600'>
            <div className='bg-white text-gray-800 p-2 rounded-md shadow-md'>Item 1</div>
          </li>
          <li className='rounded-3xl border-1 border-blue-600'>
            <div className='bg-white text-gray-800 p-2 rounded-md shadow-md'>Item 2</div>
          </li>
          <li className='rounded-3xl border-1 border-blue-600'>
            <div className='bg-white text-gray-800 p-2 rounded-md shadow-md'>Item 3</div>
          </li>
        </ul>
      </div>
    </div>
  )
}
