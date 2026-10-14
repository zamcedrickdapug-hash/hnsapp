import * as React from 'react'
import { cn } from '../../lib/utils'

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="ui-select-wrap">
        <select ref={ref} className={cn('ui-select', className)} {...props}>
          {children}
        </select>
        <span className="material-symbols-rounded ui-select__icon" aria-hidden="true">
          expand_more
        </span>
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
