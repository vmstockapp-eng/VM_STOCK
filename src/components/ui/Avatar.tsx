import React, { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '../../lib/utils'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  alt?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

export function Avatar({ src, name, size = 'sm', className, alt }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  const initial = (name?.trim()?.charAt(0) || 'U').toUpperCase()

  if (src && !imgError) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden bg-[#E7F3F1] border border-[#0D827D]/30 shrink-0 flex items-center justify-center',
          sizeClasses[size],
          className
        )}
      >
        <img
          src={src}
          alt={alt || name || 'Profile Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-[#0D827D] text-white font-bold flex items-center justify-center shadow-sm shrink-0 border border-teal-600/20 select-none',
        sizeClasses[size],
        className
      )}
      title={name || 'User Avatar'}
    >
      {initial ? initial : <User className="w-1/2 h-1/2 text-white" />}
    </div>
  )
}

export default Avatar
