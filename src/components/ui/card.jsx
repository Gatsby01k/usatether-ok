import React from 'react'
export function Card({ className='', children, ...p }){
  return <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur ${className}`} {...p}>{children}</div>
}
export function CardHeader({ className='', children, ...p }){
  return <div className={`p-4 border-b border-gray-100 dark:border-zinc-800 ${className}`} {...p}>{children}</div>
}
export function CardContent({ className='', children, ...p }){
  return <div className={`p-4 ${className}`} {...p}>{children}</div>
}
export function CardTitle({ className='', children, ...p }){
  return <h3 className={`text-lg font-semibold ${className}`} {...p}>{children}</h3>
}
export function CardDescription({ className='', children, ...p }){
  return <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`} {...p}>{children}</p>
}
