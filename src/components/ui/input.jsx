import React from 'react'
export function Input({ className='', ...props }){
  return <input className={`w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 ${className}`} {...props} />
}
