import React from 'react'
export function Button({ as:Comp='button', className='', variant='default', size='base', ...props }){
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border border-transparent shadow-sm'
  const variants = {
    default: 'bg-black text-white hover:opacity-90 dark:bg-white dark:text-black',
    outline: 'bg-transparent border-gray-300 dark:border-gray-600 text-inherit',
    ghost: 'bg-transparent shadow-none'
  }
  const sizes = { sm:'px-3 py-1.5 text-sm', lg:'px-5 py-3 text-base', icon:'p-2', base:'' }
  const cls = [base, variants[variant]||variants.default, sizes[size]||'', className].join(' ')
  const El = Comp
  return <El className={cls} {...props} />
}
export default Button
